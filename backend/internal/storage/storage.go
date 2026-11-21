package storage

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"sync"
	"time"

	_ "modernc.org/sqlite"
	"stepflow/backend/internal/data"
	"stepflow/backend/internal/models"
	"stepflow/backend/internal/provider"
)

const (
	SessionCookie   = "stepflow-session"
	SessionLifetime = 60 * 60 * 24 * 30 // 30 days in seconds
)

var (
	stepMention  = regexp.MustCompile(`(?:^|[^\pL\pN_@])@([A-Za-z0-9_]+)`)
	tokenRegex   = regexp.MustCompile(`^[a-f0-9]{64}$`)
	guideIDRegex = regexp.MustCompile(`^[a-zA-Z0-9-]+$`)
	avatarRegex  = regexp.MustCompile(`^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$`)
	roles        = []string{"Ученик", "Автор", "Администратор"}
)

type WorkspaceError struct {
	Message string
	Status  int
}

func (e *WorkspaceError) Error() string {
	return e.Message
}

func NewWorkspaceError(msg string, status ...int) *WorkspaceError {
	s := 400
	if len(status) > 0 {
		s = status[0]
	}
	return &WorkspaceError{Message: msg, Status: s}
}

type Storage struct {
	moderationWake chan struct{}
	db             *sql.DB
	mu             sync.Mutex
}

func New(dbPath string) (*Storage, error) {
	if dbPath == "" {
		dbPath = os.Getenv("STEPFLOW_DB_PATH")
		if dbPath == "" {
			dbPath = ".stepflow/stepflow.sqlite"
		}
	}

	absPath, err := filepath.Abs(dbPath)
	if err != nil {
		return nil, err
	}

	if err := os.MkdirAll(filepath.Dir(absPath), 0755); err != nil {
		return nil, err
	}

	db, err := sql.Open("sqlite", absPath)
	if err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(1)
	// PRAGMA configuration
	if _, err := db.Exec(`
		PRAGMA busy_timeout = 5000;
		PRAGMA journal_mode = WAL;
		CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL);
		CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, account TEXT NOT NULL, expires INTEGER NOT NULL);
	`); err != nil {
		return nil, err
	}

	// Check if seeded
	var count int
	row := db.QueryRow("SELECT COUNT(*) FROM workspace WHERE id = 1")
	if err := row.Scan(&count); err != nil || count == 0 {
		seed := models.State{
			Accounts: make(map[string]models.Profile),
			Guides:   data.InitialGuides,
			Runs:     make(map[string]map[string]models.Run),
			Votes:    make(map[string]map[string]models.Vote),
			Comments: []models.StepComment{},
			Reports:  []models.Report{},
			Reviews:  []models.ExpertReview{},
			Imports:  make(map[string]map[string]string),
		}
		seedBytes, err := json.Marshal(seed)
		if err != nil {
			return nil, err
		}
		if _, err := db.Exec("INSERT OR IGNORE INTO workspace VALUES (1, ?)", string(seedBytes)); err != nil {
			return nil, err
		}
	}

	store := &Storage{db: db, moderationWake: make(chan struct{}, 1)}
	if os.Getenv("STEPFLOW_DEMO_DATA") == "1" {
		if err := store.seedDemo(); err != nil {
			db.Close()
			return nil, err
		}
	}
	if err := store.queueUnreviewedTeamPublications(); err != nil {
		db.Close()
		return nil, err
	}
	return store, nil
}

func (s *Storage) Close() error {
	return s.db.Close()
}

func Digest(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

func RandomUUID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40 // Version 4
	b[8] = (b[8] & 0x3f) | 0x80 // Variant RFC4122
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

func RandomToken() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func (s *Storage) loadState(tx *sql.Tx) (*models.State, error) {
	var payloadStr string
	var err error
	if tx != nil {
		err = tx.QueryRow("SELECT payload FROM workspace WHERE id = 1").Scan(&payloadStr)
	} else {
		err = s.db.QueryRow("SELECT payload FROM workspace WHERE id = 1").Scan(&payloadStr)
	}
	if err != nil {
		return nil, err
	}

	var state models.State
	if err := json.Unmarshal([]byte(payloadStr), &state); err != nil {
		return nil, err
	}

	now := time.Now().UnixMilli()
	for id, account := range state.Accounts {
		if account.PlusTrialEndsAt > 0 && account.PlusTrialEndsAt <= now {
			account.PlusTrialEndsAt = 0
			account.Plan = "free"
			state.Accounts[id] = account
		}
	}

	for i := range state.Guides {
		// Early demo fixtures had an owner ID but lacked the ownership flag.
		guide := &state.Guides[i]
		if guide.OwnerID == "demo-v1-member" && strings.HasPrefix(guide.ID, "demo-v1-") {
			guide.Owned = true
		}
		for j := range state.Guides[i].Steps {
			if state.Guides[i].Steps[j].Checks == nil {
				state.Guides[i].Steps[j].Checks = []string{}
			}
		}
	}

	if state.Accounts == nil {
		state.Accounts = make(map[string]models.Profile)
	}
	if state.Runs == nil {
		state.Runs = make(map[string]map[string]models.Run)
	}
	if state.Votes == nil {
		state.Votes = make(map[string]map[string]models.Vote)
	}
	if state.Imports == nil {
		state.Imports = make(map[string]map[string]string)
	}
	if state.Comments == nil {
		state.Comments = []models.StepComment{}
	}
	if state.Reports == nil {
		state.Reports = []models.Report{}
	}
	if state.Reviews == nil {
		state.Reviews = []models.ExpertReview{}
	}
	if state.ModerationDecisions == nil {
		state.ModerationDecisions = []models.ModerationDecision{}
		for _, guide := range state.Guides {
			if guide.TeamID == "" && guide.ReviewedAt != "" {
				state.ModerationDecisions = append(state.ModerationDecisions, moderationDecision("legacy-"+guide.ID, guide))
			}
		}
	}

	return &state, nil
}

func (s *Storage) profileFor(tx *sql.Tx, state *models.State, token string) *models.Profile {
	if token == "" || !tokenRegex.MatchString(token) {
		return nil
	}

	hashed := Digest(token)
	now := time.Now().UnixMilli()

	var account string
	var err error
	if tx != nil {
		err = tx.QueryRow("SELECT account FROM sessions WHERE token = ? AND expires > ?", hashed, now).Scan(&account)
	} else {
		err = s.db.QueryRow("SELECT account FROM sessions WHERE token = ? AND expires > ?", hashed, now).Scan(&account)
	}

	if err != nil {
		return nil
	}

	profile, ok := state.Accounts[account]
	if !ok {
		return nil
	}
	if profile.Role == "Автор" {
		profile.Role = "Ученик"
	}
	return &profile
}

func emailKey(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func findAccount(state *models.State, email string) *models.Profile {
	target := emailKey(email)
	for _, acc := range state.Accounts {
		if emailKey(acc.Email) == target {
			cp := acc
			return &cp
		}
	}
	return nil
}

func requireCondition(cond bool, msg string, status ...int) {
	if !cond {
		panic(NewWorkspaceError(msg, status...))
	}
}

func textValidation(val any, maxLen int, required bool) string {
	str, ok := val.(string)
	requireCondition(ok && len([]rune(str)) <= maxLen, "Проверь длину полей.")
	clean := strings.TrimSpace(str)
	requireCondition(!required || clean != "", "Заполни обязательные поля.")
	return clean
}

const freeGuideLimit = 10

func requirePersonalSlot(state *models.State, profile *models.Profile) {
	if profile.Plan == "standard" || profile.Plan == "business" {
		return
	}
	count := 0
	for _, g := range state.Guides {
		if g.TeamID == "" && models.IsOwner(g, profile) {
			count++
		}
	}
	requireCondition(count < freeGuideLimit, "На бесплатном тарифе можно сохранить до 10 личных инструкций. Удали одну или подключи Plus в разделе «Подписки».", 409)
}

func deleteGuide(state *models.State, id string) {
	state.Guides = slices.DeleteFunc(state.Guides, func(g models.Instruction) bool { return g.ID == id })
	delete(state.LinkedReaders, id)
	delete(state.Runs, id)
	delete(state.Votes, id)
	delete(state.AutoReviews, id)
	state.Comments = slices.DeleteFunc(state.Comments, func(c models.StepComment) bool { return c.GuideID == id })
	state.Reports = slices.DeleteFunc(state.Reports, func(r models.Report) bool { return r.GuideID == id })
	state.Reviews = slices.DeleteFunc(state.Reviews, func(r models.ExpertReview) bool { return r.GuideID == id })
	for actor, notices := range state.Notices {
		state.Notices[actor] = slices.DeleteFunc(notices, func(n models.Notice) bool {
			link, err := url.Parse(n.Href)
			if err != nil {
				return false
			}
			switch link.Path {
			case "/moderation":
				return link.Query().Get("guide") == id
			case "/guide", "/editor", "/analytics":
				return link.Query().Get("id") == id
			}
			return false
		})
	}
}

func validateGuideID(val any) string {
	id := textValidation(val, 100, true)
	requireCondition(guideIDRegex.MatchString(id), "Некорректный идентификатор.")
	return id
}

func parseGuide(val any, profile *models.Profile, previous *models.Instruction, submit bool, id string) models.Instruction {
	raw, ok := val.(map[string]any)
	requireCondition(ok, "Некорректные данные.")

	stepsRaw, ok := raw["steps"].([]any)
	requireCondition(ok && len(stepsRaw) >= 1 && len(stepsRaw) <= 60, "В инструкции должно быть от 1 до 60 шагов.")

	steps := make([]models.Step, len(stepsRaw))
	stepIDs := make(map[string]bool)

	for i, item := range stepsRaw {
		stepMap, ok := item.(map[string]any)
		requireCondition(ok, "Некорректные данные.")

		checksRaw, ok := stepMap["checks"].([]any)
		requireCondition(ok && len(checksRaw) <= 30, "В одном шаге может быть до 30 пунктов.")

		checks := []string{}
		for _, c := range checksRaw {
			check := textValidation(c, 500, false)
			if check != "" {
				checks = append(checks, check)
			}
		}
		requireCondition(!submit || len(checks) > 0, "Добавь пункт чек-листа в каждый шаг.")

		stepID := validateGuideID(stepMap["id"])
		stepTitle := textValidation(stepMap["title"], 200, submit)
		stepText := textValidation(stepMap["text"], 16000, submit)

		var codePtr *string
		if codeVal, exists := stepMap["code"]; exists && codeVal != nil {
			c := textValidation(codeVal, 16000, false)
			codePtr = &c
		}

		var filenamePtr *string
		if fnVal, exists := stepMap["filename"]; exists && fnVal != nil {
			f := textValidation(fnVal, 200, false)
			filenamePtr = &f
		}

		steps[i] = models.Step{
			ImageURL: mediaURL(stepMap["imageUrl"]),
			VideoURL: mediaURL(stepMap["videoUrl"]),
			ID:       stepID,
			Title:    stepTitle,
			Text:     stepText,
			Code:     codePtr,
			Filename: filenamePtr,
			Checks:   checks,
		}
		stepIDs[stepID] = true
	}

	requireCondition(len(stepIDs) == len(steps), "Шаги должны иметь разные идентификаторы.")

	minutesFloat, ok := raw["minutes"].(float64)
	requireCondition(ok && !math.IsNaN(minutesFloat) && !math.IsInf(minutesFloat, 0), "Укажи время прохождения.")
	minutes := int(math.Min(1440, math.Max(1, math.Round(minutesFloat))))

	title := textValidation(raw["title"], 250, submit)
	if title == "" {
		title = "Без названия"
	}
	desc := textValidation(raw["description"], 4000, submit)
	cat := textValidation(raw["category"], 100, false)
	if cat == "" {
		cat = "Учёба"
	}

	status := models.StatusDraft
	var submittedAt string
	if submit {
		status = models.StatusPending
		submittedAt = time.Now().UTC().Format(time.RFC3339)
	}

	var cover string
	var source *models.SourceRef
	if previous != nil {
		source = previous.Source
		cover = previous.Cover
	}
	if value, present := raw["cover"]; present {
		cover = textValidation(value, 300000, false)
		requireCondition(cover == "" || (len(cover) >= 30 && strings.HasPrefix(cover, "data:image/jpeg;base64,/9j/") && avatarRegex.MatchString(cover)), "Загрузи корректное изображение для обложки.")
	}

	return models.Instruction{
		AIGenerated: raw["aiGenerated"] == true || (previous != nil && previous.AIGenerated),
		ID:          id,
		Title:       title,
		Description: desc,
		Category:    cat,
		Minutes:     minutes,
		Author:      profile.Name,
		OwnerID:     models.ActorID(*profile),
		Owned:       true,
		Status:      status,
		Source:      source,
		Cover:       cover,
		Steps:       steps,
		SubmittedAt: submittedAt,
	}
}

func computeMetrics(state *models.State, guide models.Instruction) models.GuideMetrics {
	guideRunsMap := state.Runs[guide.ID]
	var runs []models.Run
	for actor, r := range guideRunsMap {
		if actor != guide.OwnerID {
			runs = append(runs, r)
		}
	}

	reports := []models.Report{}
	for _, rep := range state.Reports {
		if rep.GuideID == guide.ID && rep.AuthorID != guide.OwnerID {
			reports = append(reports, rep)
		}
	}
	questionsByStep := make(map[string]int)
	questionAuthorsByStep := make(map[string]map[string]bool)
	for _, report := range reports {
		questionsByStep[report.StepID]++
		if report.AuthorID != "" {
			if questionAuthorsByStep[report.StepID] == nil {
				questionAuthorsByStep[report.StepID] = make(map[string]bool)
			}
			questionAuthorsByStep[report.StepID][report.AuthorID] = true
		}
	}

	var startedRuns []models.Run
	for _, run := range runs {
		hasVisited := false
		for _, step := range guide.Steps {
			for _, v := range run.Visited {
				if v == step.ID {
					hasVisited = true
					break
				}
			}
			if hasVisited {
				break
			}
		}
		if hasVisited {
			startedRuns = append(startedRuns, run)
		}
	}

	completedCount := 0
	for _, run := range startedRuns {
		allCompleted := true
		for _, step := range guide.Steps {
			found := false
			for _, c := range run.Completed {
				if c == step.ID {
					found = true
					break
				}
			}
			if !found {
				allCompleted = false
				break
			}
		}
		if allCompleted {
			completedCount++
		}
	}

	stepMetrics := make([]models.StepMetric, len(guide.Steps))
	for i, step := range guide.Steps {
		stepStarted := 0
		stepCompleted := 0
		stepStopped := 0

		for _, run := range startedRuns {
			visited := false
			for _, v := range run.Visited {
				if v == step.ID {
					visited = true
					break
				}
			}
			if visited {
				stepStarted++
			}

			completed := false
			for _, c := range run.Completed {
				if c == step.ID {
					completed = true
					break
				}
			}
			if completed {
				stepCompleted++
			}

			if run.LastStepID == step.ID && !completed {
				stepStopped++
			}
		}

		stepMetrics[i] = models.StepMetric{
			StepID:          step.ID,
			Started:         stepStarted,
			Completed:       stepCompleted,
			Stopped:         stepStopped,
			Questions:       questionsByStep[step.ID],
			QuestionAuthors: len(questionAuthorsByStep[step.ID]),
		}
	}

	counts := models.ArticleCounts{Views: len(runs)}
	for reader := range state.LinkedReaders[guide.ID] {
		if _, seen := guideRunsMap[reader]; !seen && reader != guide.OwnerID {
			counts.Views++
		}
	}
	for _, v := range state.Votes[guide.ID] {
		if v == models.VoteHelpful {
			counts.Likes++
		} else if v == models.VoteUnhelpful {
			counts.Dislikes++
		}
	}
	for _, c := range state.Comments {
		if c.GuideID == guide.ID {
			counts.Comments++
		}
	}
	return models.GuideMetrics{ArticleCounts: counts,
		Started:   len(startedRuns),
		Completed: completedCount,
		Reports:   reports,
		Steps:     stepMetrics,
	}
}

func buildSnapshot(state *models.State, profile *models.Profile) models.WorkspaceSnapshot {
	viewableGuides := []models.Instruction{}
	publicIDs := make(map[string]bool)

	for _, g := range state.Guides {
		if visible(state, g, profile) {
			viewableGuides = append(viewableGuides, g)
			if g.Status == models.StatusPublished {
				publicIDs[g.ID] = true
			}
		}
	}

	myRuns := make(map[string]models.Run)
	analytics := make(map[string]models.GuideMetrics)
	teams := []models.TeamSummary{}
	notices := []models.Notice{}
	myQuestions := []models.Report{}

	var actor string
	if profile != nil {
		actor = models.ActorID(*profile)
		for _, team := range state.Teams {
			if slices.Contains(team.MemberIDs, actor) {
				members := make([]models.TeamMember, 0, len(team.MemberIDs))
				team.MemberIDs = slices.Clone(team.MemberIDs)
				team.OwnerID = rosterID(team.OwnerID, actor)
				for i, id := range team.MemberIDs {
					team.MemberIDs[i] = rosterID(id, actor)
					if member, ok := state.Accounts[id]; ok {
						members = append(members, models.TeamMember{ID: team.MemberIDs[i], Name: member.Name, Username: member.Username})
					}
				}
				teams = append(teams, models.TeamSummary{Team: team, Members: members})
			}
		}
		notices = append(notices, state.Notices[actor]...)
		for i, notice := range notices {
			// Old moderation notices identify the document by URL but omit its title.
			if notice.Text == "Инструкцию вернули на доработку" || notice.Text == "Инструкция опубликована" {
				id := strings.TrimPrefix(notice.Href, "/editor?id=")
				for _, guide := range viewableGuides {
					if guide.ID == id {
						notices[i].Text += ": «" + guide.Title + "»"
						break
					}
				}
			}
			if notice.ID == "demo-v1-notice-"+actor && notice.Href == "/team" && notice.Text == "Демо · Команда подготовила новую инструкцию" {
				notices[i].Href = "/guide?id=demo-v1-team-guide&from=team"
				notices[i].Text = "Демо · Подготовка команды к защите"
				if actor == "demo-v1-admin" {
					notices[i].Text = "Демо · История проверок"
					notices[i].Href = "/moderation?tab=history"
				}
			}
		}
		for _, report := range state.Reports {
			if report.AuthorID == actor && publicIDs[report.GuideID] {
				myQuestions = append(myQuestions, report)
			}
		}
	}

	for _, guide := range viewableGuides {
		if actor != "" {
			if guideRuns, ok := state.Runs[guide.ID]; ok {
				if run, hasRun := guideRuns[actor]; hasRun {
					if run.Completed == nil {
						run.Completed = []string{}
					}
					currentIdx := -1
					for i, s := range guide.Steps {
						if s.ID == run.LastStepID {
							currentIdx = i
							break
						}
					}
					if currentIdx < 0 {
						currentIdx = 0
					}
					run.Current = currentIdx
					myRuns[guide.ID] = run
				}
			}
		}

		if models.IsOwner(guide, profile) {
			analytics[guide.ID] = computeMetrics(state, guide)
		}
	}

	filteredComments := []models.StepComment{}
	for _, c := range state.Comments {
		if publicIDs[c.GuideID] {
			for _, vote := range c.Reactions {
				if vote == models.VoteHelpful {
					c.Likes++
				} else if vote == models.VoteUnhelpful {
					c.Dislikes++
				}
			}
			c.MyVote = c.Reactions[actor]
			c.Reactions = nil
			filteredComments = append(filteredComments, c)
		}
	}

	filteredReviews := []models.ExpertReview{}
	for _, r := range state.Reviews {
		if publicIDs[r.GuideID] {
			filteredReviews = append(filteredReviews, r)
		}
	}

	filteredVotes := make(map[string]map[string]models.Vote)
	for gid, vmap := range state.Votes {
		if publicIDs[gid] {
			filteredVotes[gid] = vmap
		}
	}

	var autoModeration *bool
	var moderation *models.ModerationData
	if models.IsAdmin(profile) {
		autoModeration = &state.AutoModeration
		moderation = &models.ModerationData{ManualReviewNotes: map[string]string{}, Decisions: state.ModerationDecisions, Experts: []models.ExpertSummary{}}
		for _, g := range state.Guides {
			metrics, ok := analytics[g.ID]
			if !ok {
				metrics = computeMetrics(state, g)
			}
			moderation.Posts = append(moderation.Posts, models.PostStats{ArticleCounts: metrics.ArticleCounts, ID: g.ID, Title: g.Title, Started: metrics.Started, Completed: metrics.Completed, Reports: metrics.Reports})
		}
		if state.AutoModeration && !provider.Configured() {
			moderation.PausedReason = "Автопроверка приостановлена. Проверьте настройки ИИ-сервиса на сервере."
		}
		for id, attempt := range state.AutoReviews {
			if attempt.ManualNote != "" {
				moderation.ManualReviewNotes[id] = attempt.ManualNote
			}
		}
		for _, account := range state.Accounts {
			if account.Role == "Эксперт" {
				moderation.Experts = append(moderation.Experts, models.ExpertSummary{
					ID: models.ActorID(account), Name: account.Name, Email: account.Email, Active: models.IsExpert(&account),
				})
			}
		}
	}

	return models.WorkspaceSnapshot{
		Profile: profile,
		Data: models.WorkspaceData{
			MyQuestions:    myQuestions,
			Teams:          teams,
			Notices:        notices,
			Guides:         viewableGuides,
			Runs:           myRuns,
			Votes:          filteredVotes,
			Comments:       filteredComments,
			Reviews:        filteredReviews,
			Analytics:      analytics,
			Moderation:     moderation,
			AutoModeration: autoModeration,
		},
	}
}

func (s *Storage) GetProfile(token string) (*models.Profile, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	state, err := s.loadState(nil)
	if err != nil {
		return nil, err
	}
	return s.profileFor(nil, state, token), nil
}

func (s *Storage) ReadWorkspace(token string) (*models.WorkspaceSnapshot, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	state, err := s.loadState(nil)
	if err != nil {
		return nil, err
	}

	profile := s.profileFor(nil, state, token)
	snap := buildSnapshot(state, profile)
	return &snap, nil
}

func (s *Storage) GetPublishedGuide(id string) (*models.Instruction, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	state, err := s.loadState(nil)
	if err != nil {
		return nil, err
	}

	for _, g := range state.Guides {
		if g.ID == id && g.TeamID == "" && g.Status == models.StatusPublished {
			cp := g
			return &cp, nil
		}
	}
	return nil, nil
}

func (s *Storage) GuideForStepHint(token, guideID string) (*models.Instruction, []string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	state, err := s.loadState(nil)
	if err != nil {
		return nil, nil, err
	}
	profile := s.profileFor(nil, state, token)
	if profile == nil {
		return nil, nil, NewWorkspaceError("Войди в аккаунт, чтобы получить подсказку.", 401)
	}
	for _, guide := range state.Guides {
		if guide.ID == guideID && guide.Status == models.StatusPublished && visible(state, guide, profile) {
			return &guide, state.Runs[guideID][models.ActorID(*profile)].Completed, nil
		}
	}
	return nil, nil, NewWorkspaceError("Инструкция не найдена.", 404)
}

func (s *Storage) ChangeWorkspace(token string, input []byte) (result *models.CommandResult, nextToken *string, err error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	defer func() {
		if r := recover(); r != nil {
			if wErr, ok := r.(*WorkspaceError); ok {
				err = wErr
			} else {
				err = fmt.Errorf("%v", r)
			}
		}
	}()

	var command map[string]any
	if err := json.Unmarshal(input, &command); err != nil {
		return nil, nil, NewWorkspaceError("Некорректный JSON.", 400)
	}

	tx, err := s.db.Begin()
	if err != nil {
		return nil, nil, err
	}
	defer tx.Rollback()

	state, err := s.loadState(tx)
	if err != nil {
		return nil, nil, err
	}

	current := s.profileFor(tx, state, token)
	profile := current
	var outNextToken *string
	var outID string
	var outCount *int

	cmdType, _ := command["type"].(string)

	switch cmdType {
	case "register", "login":
		registering := cmdType == "register"
		var email, username string
		var role string
		var name string

		if registering {
			rawProfile, ok := command["profile"].(map[string]any)
			requireCondition(ok, "Некорректные данные.")
			email = textValidation(rawProfile["email"], 254, true)
			username = availableUsername(state, rawProfile["username"], "")
			role = "Ученик"
			name = textValidation(rawProfile["name"], 100, false)
			if name == "" {
				name = "Участник"
			}
		} else {
			email = textValidation(command["email"], 254, false)
			role = "Ученик"
			name = "Участник"
		}

		roleValid := false
		for _, r := range roles {
			if r == role {
				roleValid = true
				break
			}
		}
		requireCondition(roleValid, "Выбери доступную роль.")

		existing := findAccount(state, email)
		requireCondition(registering || existing != nil, "Профиль с таким email не найден. Сначала зарегистрируйся.", 404)
		requireCondition(!registering || existing == nil, "Такой профиль уже есть. Нажми «Вход».", 409)

		if existing != nil {
			profile = existing
		} else {
			profile = &models.Profile{
				ID:       RandomUUID(),
				Username: username,
				Email:    email,
				Role:     role,
				Name:     name,
			}
		}

		state.Accounts[models.ActorID(*profile)] = *profile
		now := time.Now().UnixMilli()

		_, _ = tx.Exec("DELETE FROM sessions WHERE expires <= ?", now)

		tok := RandomToken()
		outNextToken = &tok
		expires := now + SessionLifetime*1000

		if _, err := tx.Exec("INSERT INTO sessions VALUES (?, ?, ?)", Digest(tok), models.ActorID(*profile), expires); err != nil {
			return nil, nil, err
		}

		if token != "" {
			_, _ = tx.Exec("DELETE FROM sessions WHERE token = ?", Digest(token))
		}

	case "logout":
		if token != "" {
			_, _ = tx.Exec("DELETE FROM sessions WHERE token = ?", Digest(token))
		}
		profile = nil
		emptyStr := ""
		outNextToken = &emptyStr

	default:
		requireCondition(current != nil, "Войди в аккаунт, чтобы продолжить.", 401)
		actor := models.ActorID(*current)

		if cmdType == "team-member-search" {
			team := teamForOwner(state, command, actor)
			member := teamCandidate(state, command["username"])
			requireCondition(!slices.Contains(team.MemberIDs, models.ActorID(*member)), "Участник уже в команде.", 409)
			snap := buildSnapshot(state, profile)
			return &models.CommandResult{Profile: snap.Profile, Data: snap.Data, MemberMatch: &models.UserMatch{Name: member.Name, Username: member.Username, Selection: Digest(models.ActorID(*member))}}, nil, nil
		}

		if changeAccount(state, current, cmdType, command) {
			break
		}

		if cmdType == "profile" {
			edits, ok := command["edits"].(map[string]any)
			requireCondition(ok, "Некорректные данные.")
			email := textValidation(edits["email"], 254, true)
			existing := findAccount(state, email)
			requireCondition(existing == nil || models.ActorID(*existing) == actor, "Этот email уже используется.", 409)

			var avatar string
			if avVal, exists := edits["avatar"]; exists && avVal != nil {
				avatar = textValidation(avVal, 450000, false)
				requireCondition(avatar == "" || avatarRegex.MatchString(avatar), "Не удалось сохранить это фото.")
			}

			var bio string
			if bioVal, exists := edits["bio"]; exists && bioVal != nil {
				bio = textValidation(bioVal, 400, false)
			}
			name := textValidation(edits["name"], 100, true)

			updated := *current
			updated.ID = actor
			if raw, present := edits["username"]; present {
				updated.Username = availableUsername(state, raw, actor)
			}
			updated.Email = email
			updated.Name = name
			updated.Bio = bio
			updated.Avatar = avatar
			profile = &updated
			state.Accounts[actor] = updated
			break
		}

		if cmdType == "save" {
			rawGuide, ok := command["guide"].(map[string]any)
			requireCondition(ok, "Некорректные данные.")
			requested := validateGuideID(rawGuide["id"])

			prevIndex := -1
			for i, g := range state.Guides {
				if g.ID == requested {
					prevIndex = i
					break
				}
			}

			var previous *models.Instruction
			if prevIndex != -1 {
				previous = &state.Guides[prevIndex]

			}

			if previous == nil {
				requireCondition(command["updateOnly"] != true && rawGuide["revision"] == nil, "Инструкция больше недоступна.", 404)
			}

			var teamID string
			if previous != nil {
				teamID = previous.TeamID
			} else if rawGuide["teamId"] != nil {
				teamID = validateGuideID(rawGuide["teamId"])
			}
			team := memberTeam(state, teamID, actor)
			requireCondition(teamID == "" || (team != nil && team.Active), "Редактирование доступно участникам активной команды.", 403)
			revision := 1
			if previous != nil {
				requireCondition(team != nil || models.IsOwner(*previous, current), "Редактировать может только автор.", 403)
				incoming, ok := rawGuide["revision"].(float64)
				requireCondition((ok || rawGuide["revision"] == nil) && incoming == float64(previous.Revision), "Кто-то уже сохранил правки. Обнови редактор.", 409)
				revision = previous.Revision + 1
			}
			id := requested
			if previous == nil {
				if team == nil {
					requirePersonalSlot(state, current)
				}
				id = RandomUUID()
			}

			submit, _ := command["submit"].(bool)
			guide := parseGuide(rawGuide, current, previous, submit, id)
			guide.Revision = revision
			if team != nil {
				guide.TeamID = team.ID
				if previous != nil {
					guide.OwnerID, guide.Author = previous.OwnerID, previous.Author
				}
			}

			if submit {
				message := "На проверку поступила инструкция"
				if previous != nil && previous.Status == models.StatusPending {
					message = "Автор обновил инструкцию на проверке"
				}
				notifyModerators(state, &guide, actor, message)
			}
			if previous != nil {
				delete(state.AutoReviews, id)
				state.Guides[prevIndex] = guide
			} else {
				state.Guides = append([]models.Instruction{guide}, state.Guides...)
			}

			var newReviews []models.ExpertReview
			for _, rev := range state.Reviews {
				if rev.GuideID != id {
					newReviews = append(newReviews, rev)
				}
			}
			state.Reviews = newReviews
			outID = id
			break
		}

		if cmdType == "import" {
			guidesRaw, ok := command["guides"].([]any)
			requireCondition(ok && len(guidesRaw) <= 30, "Можно перенести до 30 черновиков за раз.")

			if state.Imports[actor] == nil {
				state.Imports[actor] = make(map[string]string)
			}
			imported := state.Imports[actor]

			cnt := 0
			for _, incoming := range guidesRaw {
				incomingMap, ok := incoming.(map[string]any)
				requireCondition(ok, "Некорректные данные.")
				sourceID := validateGuideID(incomingMap["id"])

				if _, exists := imported[sourceID]; exists {
					continue
				}

				requirePersonalSlot(state, current)
				newID := RandomUUID()
				g := parseGuide(incomingMap, current, nil, false, newID)
				state.Guides = append([]models.Instruction{g}, state.Guides...)
				imported[sourceID] = newID
				cnt++
			}
			outCount = &cnt
			break
		}

		key := validateGuideID(command["guideId"])
		var guide *models.Instruction
		for i, g := range state.Guides {
			if g.ID == key {
				guide = &state.Guides[i]
				break
			}
		}

		requireCondition(guide != nil && visible(state, *guide, current), "Инструкция недоступна.", 404)

		if cmdType == "delete-guide" {
			allowed := models.IsOwner(*guide, current)
			if guide.TeamID != "" {
				team := memberTeam(state, guide.TeamID, actor)
				allowed = team != nil && team.Active && (allowed || team.OwnerID == actor)
			}
			requireCondition(allowed, "Удалить инструкцию может автор или владелец команды.", 403)
			requireCondition(command["revision"] == float64(guide.Revision) && command["status"] == string(guide.Status), "Инструкция изменилась. Обнови страницу перед удалением.", 409)
			if team := memberTeam(state, guide.TeamID, actor); team != nil && guide.Status == models.StatusPublished {
				notifyTeam(state, team, actor, "В команде удалена инструкция «"+guide.Title+"»", "/team/overview?id="+team.ID)
			}
			deleteGuide(state, key)
			break
		}

		if cmdType == "moderate" {
			requireCondition(models.IsAdmin(current), "Решение принимает администратор.", 403)
			requireCondition(guide.Status == models.StatusPending, "Решение уже принято или инструкция отозвана.", 409)
			if command["revision"] != nil {
				revision, ok := command["revision"].(float64)
				requireCondition(ok && revision == float64(guide.Revision), "Автор обновил инструкцию. Открой новую версию перед проверкой.", 409)
			}

			decision, _ := command["decision"].(string)
			requireCondition(decision == "approve" || decision == "reject", "Выбери решение.")

			note := textValidation(command["note"], 2000, decision == "reject")
			applyModeration(state, guide, decision, note, current.Name, actor)
			break
		}

		requireCondition(guide.Status == models.StatusPublished, "Действие доступно после публикации.", 403)

		if cmdType == "reply" {
			requireCondition(models.IsOwner(*guide, current), "Ответить на вопрос может автор.", 403)
			index := slices.IndexFunc(state.Reports, func(r models.Report) bool { return r.GuideID == key && r.ID == command["reportId"] })
			requireCondition(index >= 0, "Вопрос не найден.", 404)
			report := &state.Reports[index]
			report.Reply = textValidation(command["text"], 2000, true)
			query := url.Values{"id": {key}, "step": {report.StepID}}
			if canReceiveGuideNotice(state, guide, report.AuthorID) {
				notify(state, report.AuthorID, actor, "Ответ на вопрос по инструкции «"+guide.Title+"»: "+report.Reply, "/guide?"+query.Encode()+"#answer-"+report.ID)
			}
			break
		}

		if cmdType == "fork" {
			requireCondition(guide.TeamID == "", "Командная инструкция доступна внутри команды.", 403)
			requirePersonalSlot(state, current)
			outID = RandomUUID()
			title := guide.Title
			if len([]rune(title)) > 230 {
				title = string([]rune(title)[:230])
			}
			title = title + " — моя версия"

			forkedSteps := make([]models.Step, len(guide.Steps))
			for i, s := range guide.Steps {
				forkedSteps[i] = s
				forkedSteps[i].ID = RandomUUID()
			}

			forkedGuide := models.Instruction{
				ID:          outID,
				Title:       title,
				Cover:       guide.Cover,
				Description: guide.Description,
				Category:    guide.Category,
				Minutes:     guide.Minutes,
				Author:      current.Name,
				OwnerID:     actor,
				Owned:       true,
				Status:      models.StatusDraft,
				Source: &models.SourceRef{
					ID:     guide.ID,
					Title:  guide.Title,
					Author: guide.Author,
				},
				Steps: forkedSteps,
			}

			notify(state, guide.OwnerID, actor, "По твоей инструкции «"+guide.Title+"» создали форк", "/guide?id="+key)
			state.Guides = append([]models.Instruction{forkedGuide}, state.Guides...)
			break
		}

		if cmdType == "view" {
			if actor != guide.OwnerID {
				if state.LinkedReaders == nil {
					state.LinkedReaders = map[string]map[string]bool{}
				}
				if state.LinkedReaders[key] == nil {
					state.LinkedReaders[key] = map[string]bool{}
				}
				state.LinkedReaders[key][actor] = true
			}
			break
		}
		if cmdType == "comment-vote" {
			i := slices.IndexFunc(state.Comments, func(c models.StepComment) bool { return c.GuideID == key && c.ID == command["commentId"] })
			requireCondition(i >= 0, "Комментарий не найден.", 404)
			value, ok := command["value"].(string)
			requireCondition(ok && (value == "" || value == string(models.VoteHelpful) || value == string(models.VoteUnhelpful)), "Неизвестная оценка.")
			c := &state.Comments[i]
			if c.Reactions == nil {
				c.Reactions = map[string]models.Vote{}
			}
			if value == "" {
				delete(c.Reactions, actor)
			} else {
				c.Reactions[actor] = models.Vote(value)
			}
			break
		}
		if cmdType == "vote" {
			val, _ := command["value"].(string)
			requireCondition(val == string(models.VoteHelpful) || val == string(models.VoteUnhelpful), "Неизвестная оценка.")
			if state.Votes[key] == nil {
				state.Votes[key] = make(map[string]models.Vote)
			}
			if state.Votes[key][actor] == models.Vote(val) {
				delete(state.Votes[key], actor)
			} else {
				state.Votes[key][actor] = models.Vote(val)
				if canReceiveGuideNotice(state, guide, guide.OwnerID) {
					notify(state, guide.OwnerID, actor, "Новая оценка инструкции «"+guide.Title+"»", "/guide?id="+key)
				}
			}
			break
		}

		if cmdType == "review" {
			requireCondition(models.IsExpert(current) && guide.TeamID == "" && !models.IsOwner(*guide, current), "Рецензию может оставить эксперт на чужую инструкцию.", 403)
			verified, ok := command["verified"].(bool)
			requireCondition(ok, "Выбери результат проверки.")
			text := textValidation(command["text"], 2000, true)

			review := models.ExpertReview{
				GuideID:    key,
				ExpertID:   actor,
				ExpertName: current.Name,
				Verified:   verified,
				Text:       text,
				CreatedAt:  time.Now().UTC().Format(time.RFC3339),
			}

			var newReviews []models.ExpertReview
			for _, rev := range state.Reviews {
				if rev.GuideID != key || rev.ExpertID != actor {
					newReviews = append(newReviews, rev)
				}
			}
			state.Reviews = append([]models.ExpertReview{review}, newReviews...)
			notify(state, guide.OwnerID, actor, "Рецензия на инструкцию «"+guide.Title+"»", "/guide?id="+key+"#expert-reviews")
			break
		}

		stepIDVal, _ := command["stepId"].(string)
		stepIndex := -1
		for i, s := range guide.Steps {
			if s.ID == stepIDVal {
				stepIndex = i
				break
			}
		}
		requireCondition(stepIndex != -1, "Шаг не найден.", 404)
		step := guide.Steps[stepIndex]

		if cmdType == "comment" || cmdType == "help" {
			maxLen := 2000
			if cmdType == "help" {
				maxLen = 1500
			}
			content := textValidation(command["text"], maxLen, true)
			entryID := RandomUUID()

			if cmdType == "comment" {
				recipients := map[string]bool{guide.OwnerID: false}
				for _, comment := range state.Comments {
					if comment.GuideID == key && comment.StepID == step.ID {
						recipients[comment.AuthorID] = false
					}
				}
				href := "/guide?" + url.Values{"id": {key}, "step": {step.ID}}.Encode() + "#comment-" + entryID
				names := map[string]bool{}
				for _, match := range stepMention.FindAllStringSubmatch(content, -1) {
					names[strings.ToLower(match[1])] = true
				}
				for _, team := range state.Teams {
					if len(names) == 0 || !team.Active || !slices.Contains(team.MemberIDs, actor) || (guide.TeamID != "" && team.ID != guide.TeamID) {
						continue
					}
					for _, id := range team.MemberIDs {
						if member, ok := state.Accounts[id]; ok && names[member.Username] {
							recipients[id] = true
						}
					}
				}
				for recipient, mentioned := range recipients {
					if canReceiveGuideNotice(state, guide, recipient) {
						message := "Комментарий к «" + guide.Title + "», шаг «" + step.Title + "»"
						if mentioned {
							message = current.Name + " зовёт тебя на шаг «" + step.Title + "» в инструкции «" + guide.Title + "»"
						}
						notify(state, recipient, actor, message, href)
					}
				}
				state.Comments = append(state.Comments, models.StepComment{
					ID:         entryID,
					GuideID:    key,
					StepID:     step.ID,
					Text:       content,
					AuthorID:   actor,
					AuthorName: current.Name,
					CreatedAt:  time.Now().UTC().Format(time.RFC3339),
				})
			} else {
				requireCondition(guide.Owned && canReceiveGuideNotice(state, guide, guide.OwnerID), "Автор недоступен. Можно написать в комментариях к шагу.", 409)
				notify(state, guide.OwnerID, actor, "Вопрос по инструкции «"+guide.Title+"», шаг «"+step.Title+"»", "/analytics?id="+key+"#question-"+entryID)
				state.Reports = append(state.Reports, models.Report{
					ID:       entryID,
					GuideID:  key,
					StepID:   step.ID,
					Text:     content,
					AuthorID: actor,
				})
			}
			break
		}

		requireCondition(cmdType == "visit" || cmdType == "check" || cmdType == "complete", "Неизвестное действие.")

		if state.Runs[key] == nil {
			state.Runs[key] = make(map[string]models.Run)
		}
		run, hasRun := state.Runs[key][actor]
		if !hasRun {
			run = models.DefaultRun()
		}

		run.Current = stepIndex

		hasVisited := false
		for _, v := range run.Visited {
			if v == step.ID {
				hasVisited = true
				break
			}
		}
		if !hasVisited {
			run.Visited = append(run.Visited, step.ID)
		}
		run.LastStepID = step.ID
		run.UpdatedAt = time.Now().UnixMilli()

		if cmdType == "check" {
			checkIdxFloat, ok := command["index"].(float64)
			checkIdx := int(checkIdxFloat)
			requireCondition(ok && float64(checkIdx) == checkIdxFloat && checkIdx >= 0 && checkIdx < len(step.Checks), "Пункт чек-листа не найден.")
			checked, ok := command["checked"].(bool)
			requireCondition(ok, "Пункт чек-листа не найден.")

			if run.Checked == nil {
				run.Checked = make(map[string][]bool)
			}
			ticks := run.Checked[step.ID]
			for len(ticks) < len(step.Checks) {
				ticks = append(ticks, false)
			}
			ticks = ticks[:len(step.Checks)]
			ticks[checkIdx] = checked
			run.Checked[step.ID] = ticks

			if !checked {
				newCompleted := []string{}
				for _, c := range run.Completed {
					if c != step.ID {
						newCompleted = append(newCompleted, c)
					}
				}
				run.Completed = newCompleted
			}
		}

		if cmdType == "complete" {
			ticks := run.Checked[step.ID]
			allChecked := len(ticks) == len(step.Checks) && len(step.Checks) > 0
			for _, t := range ticks {
				if !t {
					allChecked = false
					break
				}
			}
			requireCondition(allChecked, "Отметь все пункты этого шага.")

			hasCompleted := false
			for _, c := range run.Completed {
				if c == step.ID {
					hasCompleted = true
					break
				}
			}
			if !hasCompleted {
				run.Completed = append(run.Completed, step.ID)
			}

			remaining := -1
			for i, s := range guide.Steps {
				isComp := false
				for _, c := range run.Completed {
					if c == s.ID {
						isComp = true
						break
					}
				}
				if !isComp {
					remaining = i
					break
				}
			}

			if remaining != -1 {
				if stepIndex+1 < len(guide.Steps) {
					run.Current = stepIndex + 1
				} else {
					run.Current = remaining
				}
				nextStep := guide.Steps[run.Current]
				run.LastStepID = nextStep.ID

				nextVisited := false
				for _, v := range run.Visited {
					if v == nextStep.ID {
						nextVisited = true
						break
					}
				}
				if !nextVisited {
					run.Visited = append(run.Visited, nextStep.ID)
				}
			}
		}

		state.Runs[key][actor] = run
	}

	snap := buildSnapshot(state, profile)
	result = &models.CommandResult{
		Profile: snap.Profile,
		Data:    snap.Data,
		ID:      outID,
		Count:   outCount,
	}

	if err := saveState(tx, state); err != nil {
		return nil, nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, nil, err
	}

	if cmdType == "auto-moderation" || (cmdType == "save" && command["submit"] == true && state.AutoModeration) {
		select {
		case s.moderationWake <- struct{}{}:
		default:
		}
	}
	return result, outNextToken, nil
}
