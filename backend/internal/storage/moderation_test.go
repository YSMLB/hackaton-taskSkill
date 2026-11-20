package storage

import (
	"encoding/json"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"stepflow/backend/internal/models"
)

func TestPausedModerationStatus(t *testing.T) {
	t.Setenv("AI_API_KEY", "")
	state := &models.State{AutoModeration: true}
	admin := &models.Profile{Role: "Администратор"}
	if buildSnapshot(state, admin).Data.Moderation.PausedReason == "" {
		t.Fatal("admin should see why the enabled worker is paused")
	}
	if buildSnapshot(state, &models.Profile{Role: "Автор"}).Data.Moderation != nil {
		t.Fatal("author received admin moderation status")
	}
	state.AutoModeration = false
	if buildSnapshot(state, admin).Data.Moderation.PausedReason != "" {
		t.Fatal("disabled worker should not report a missing provider")
	}
}

func TestAutomaticModerationUsesCurrentSubmittedVersion(t *testing.T) {
	t.Setenv("AI_API_KEY", "test")
	t.Setenv("AI_BASE_URL", "http://127.0.0.1")
	t.Setenv("AI_MODEL", "test")
	path := filepath.Join(t.TempDir(), "workspace.sqlite")
	db, err := New(path)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = db.Close() }()
	type cmd = map[string]any
	send := func(token string, c cmd) (*models.CommandResult, *string) {
		t.Helper()
		b, err := json.Marshal(c)
		if err != nil {
			t.Fatal(err)
		}
		r, next, err := db.ChangeWorkspace(token, b)
		if err != nil {
			t.Fatal(err)
		}
		return r, next
	}
	register := func(role, username string) string {
		_, tok := send("", cmd{"type": "register", "profile": cmd{"username": username, "email": role + "@example.test", "name": role, "role": role}})
		return *tok
	}
	admin, author := register("Администратор", "admin"), register("Автор", "author")
	// Self-registration now always creates a learner. Grant only the fixture account admin rights.
	adminProfile, err := db.GetProfile(admin)
	if err != nil || adminProfile == nil {
		t.Fatalf("admin fixture: %v", err)
	}
	_, err = db.db.Exec(`UPDATE workspace SET payload=json_set(payload, ?, ?) WHERE id=1`, `$.accounts."`+adminProfile.ID+`".role`, "Администратор")
	if err != nil {
		t.Fatal(err)
	}
	setting := func(enabled bool) { send(admin, cmd{"type": "auto-moderation", "enabled": enabled}) }
	draft := cmd{"id": "test", "title": "План урока", "category": "Учёба", "description": "Описание", "minutes": 10, "steps": []cmd{{"id": "one", "title": "Запиши", "text": "Текст", "checks": []string{"Готово"}}}}
	submit := func() {
		r, _ := send(author, cmd{"type": "save", "guide": draft, "submit": true})
		draft["id"] = r.ID
		for _, g := range r.Data.Guides {
			if g.ID == r.ID {
				draft["revision"] = g.Revision
				return
			}
		}
		t.Fatal("missing guide")
	}
	job := func() *ModerationJob {
		t.Helper()
		j, err := db.NextModerationJob()
		if err != nil {
			t.Fatal(err)
		}
		return j
	}
	record := func(j *ModerationJob, decision, note string) {
		t.Helper()
		if j == nil {
			t.Fatal("no pending job")
		}
		if err := db.RecordModeration(*j, decision, note); err != nil {
			t.Fatal(err)
		}
	}
	requireQueued := func() *ModerationJob {
		t.Helper()
		j := job()
		if j == nil || j.Guide.ID != draft["id"] {
			t.Fatal("missing pending guide")
		}
		return j
	}

	if _, _, err := db.ChangeWorkspace(author, []byte(`{"type":"auto-moderation","enabled":true}`)); err == nil {
		t.Fatal("author could enable automation")
	}
	submit()
	if job() != nil {
		t.Fatal("default mode should be manual")
	}
	setting(true)
	first := requireQueued()
	submit()
	record(first, "approve", "stale revision")
	current := requireQueued()
	setting(false)
	setting(true)
	record(current, "approve", "stale setting")
	current = requireQueued()
	record(current, "manual", "Проверьте ссылку.")
	adminFeed, err := db.ReadWorkspace(admin)
	if err != nil {
		t.Fatal(err)
	}
	notices := adminFeed.Data.Notices
	reviewLink := "/moderation?guide=" + current.Guide.ID + "&revision=" + strconv.Itoa(current.Guide.Revision)
	if len(notices) != 3 || notices[0].Href != reviewLink || notices[1].Href != reviewLink ||
		!strings.Contains(notices[0].Text, "ручная проверка") || !strings.Contains(notices[1].Text, "обновил") {
		t.Fatal("expected separate admin notices for submission, current revision and manual referral", notices)
	}
	if job() != nil {
		t.Fatal("uncertain revision was requeued")
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
	reopened, err := New(path)
	if err != nil {
		t.Fatal(err)
	}
	db = reopened
	snapshot, err := db.ReadWorkspace(admin)
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.Data.AutoModeration == nil || !*snapshot.Data.AutoModeration || snapshot.Data.Moderation.ManualReviewNotes[current.Guide.ID] == "" || job() != nil {
		t.Fatal("lost review state on restart")
	}

	tx, err := db.db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	state, err := db.loadState(tx)
	if err != nil {
		t.Fatal(err)
	}
	state.AutoReviews[current.Guide.ID] = models.AutoReviewAttempt{ManualNote: "Решение по старым правилам."}
	if err := saveState(tx, state); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
	record(requireQueued(), "manual", "Требуется решение администратора.")
	if job() != nil {
		t.Fatal("previous referral should be rechecked only once")
	}

	submit()
	current = requireQueued()
	record(current, "retry", "")
	if job() != nil {
		t.Fatal("provider failure should wait before retrying")
	}
	submit()
	current = requireQueued()
	record(current, "reject", "Уточните шаги.")
	record(current, "approve", "late response")
	snapshot, err = db.ReadWorkspace(admin)
	if err != nil {
		t.Fatal(err)
	}
	decisions := snapshot.Data.Moderation.Decisions
	if len(decisions) != 1 || decisions[0].Reviewer != "ИИ-модератор" || decisions[0].Approved || decisions[0].Note != "Уточните шаги." {
		t.Fatalf("unexpected audit: %#v", decisions)
	}
	submit()
	current = requireQueued()
	send(admin, cmd{"type": "moderate", "guideId": current.Guide.ID, "decision": "approve", "note": "", "revision": current.Guide.Revision})
	record(current, "reject", "late response")
	g, err := db.GetPublishedGuide(current.Guide.ID)
	if err != nil || g == nil || g.ReviewedBy != "Администратор" {
		t.Fatal("lost manual decision")
	}
	submit()
	current = requireQueued()
	record(current, "approve", "Шаги понятны.")
	published, err := db.GetPublishedGuide(current.Guide.ID)
	if err != nil || published == nil || published.ReviewedBy != "ИИ-модератор" {
		t.Fatal("automatic publication failed")
	}
	snapshot, err = db.ReadWorkspace(author)
	if err != nil || snapshot.Data.AutoModeration != nil || len(snapshot.Data.Notices) == 0 {
		t.Fatal("author snapshot missing notification or exposing admin setting")
	}
}

func TestProviderFailuresEventuallyRequireManualReview(t *testing.T) {
	db, err := New(filepath.Join(t.TempDir(), "state.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	tx, err := db.db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	state, err := db.loadState(tx)
	if err != nil {
		t.Fatal(err)
	}
	state.AutoModeration = true
	guide := models.Instruction{ID: "test", Status: models.StatusPending, Revision: 1}
	state.Guides = append(state.Guides, guide)
	state.AutoReviews = map[string]models.AutoReviewAttempt{guide.ID: {Failures: 2, RetryAt: time.Now().Add(-time.Minute).Unix()}}
	if err = saveState(tx, state); err != nil {
		t.Fatal(err)
	}
	if err = tx.Commit(); err != nil {
		t.Fatal(err)
	}
	j, err := db.NextModerationJob()
	if err != nil || j == nil {
		t.Fatalf("missing last retry: %v", err)
	}
	if err = db.RecordModeration(*j, "retry", ""); err != nil {
		t.Fatal(err)
	}
	if j, err = db.NextModerationJob(); err != nil || j != nil {
		t.Fatalf("unexpected extra retry: %v", err)
	}
	state, err = db.loadState(nil)
	if err != nil || state.AutoReviews[guide.ID].ManualNote == "" || len(state.ModerationDecisions) > 0 {
		t.Fatal("error became an automated decision")
	}
}
func TestTeamSubmissionUsesModerationQueue(t *testing.T) {
	t.Setenv("STEPFLOW_DEMO_DATA", "1")
	t.Setenv("AI_API_KEY", "test")
	t.Setenv("AI_MODEL", "test")
	t.Setenv("AI_BASE_URL", "http://localhost")
	db, err := New(filepath.Join(t.TempDir(), "team.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	send := func(token, body string) (*models.CommandResult, *string) {
		t.Helper()
		r, next, err := db.ChangeWorkspace(token, []byte(body))
		if err != nil {
			t.Fatal(err)
		}
		return r, next
	}
	_, owner := send("", `{"type":"login","email":"member@stepflow.test"}`)
	_, admin := send("", `{"type":"login","email":"admin@stepflow.test"}`)
	submitted, _ := send(*owner, `{"type":"save","submit":true,"guide":{"id":"new","teamId":"demo-v1-team","title":"Собери отчёт","description":"Составь отчёт по шагам","minutes":10,"category":"Работа","steps":[{"id":"step","title":"Запиши выводы","text":"Открой документ и запиши результат","checks":["Готово"]}]}}`)
	adminView, _ := send(*admin, `{"type":"auto-moderation","enabled":true}`)
	found := false
	for _, g := range adminView.Data.Guides {
		if g.ID == submitted.ID && g.Status == models.StatusPending {
			found = true
		}
	}
	if !found {
		t.Fatal("missing team submission in admin queue")
	}
	for {
		job, err := db.NextModerationJob()
		if err != nil || job == nil {
			t.Fatal("team job missing", err)
		}
		if job.Guide.ID == submitted.ID {
			if err := db.RecordModeration(*job, "approve", "Готово"); err != nil {
				t.Fatal(err)
			}
			break
		}
		if err := db.RecordModeration(*job, "manual", "Проверить"); err != nil {
			t.Fatal(err)
		}
	}
	view, err := db.ReadWorkspace(*owner)
	if err != nil {
		t.Fatal(err)
	}
	for _, g := range view.Data.Guides {
		if g.ID == submitted.ID && g.Status == models.StatusPublished && g.TeamID == "demo-v1-team" {
			public, err := db.GetPublishedGuide(g.ID)
			if err != nil || public != nil {
				t.Fatal("private guide exposed")
			}
			return
		}
	}
	t.Fatal("approved team guide unavailable")
}
func TestLegacyTeamPublicationRequeuedOnce(t *testing.T) {
	t.Setenv("STEPFLOW_DEMO_DATA", "1")
	db, err := New(filepath.Join(t.TempDir(), "legacy-team.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	tx, err := db.db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	state, err := db.loadState(tx)
	if err != nil {
		t.Fatal(err)
	}
	guide := models.Instruction{ID: "legacy-team", TeamID: "demo-v1-team", Status: models.StatusPublished, Revision: 3}
	state.Guides = append(state.Guides, guide)
	state.AutoModeration = true
	if err = saveState(tx, state); err != nil {
		t.Fatal(err)
	}
	if err = tx.Commit(); err != nil {
		t.Fatal(err)
	}
	for range 2 {
		if err = db.queueUnreviewedTeamPublications(); err != nil {
			t.Fatal(err)
		}
	}
	state, err = db.loadState(nil)
	if err != nil {
		t.Fatal(err)
	}
	var count int
	for _, n := range state.Notices["demo-v1-admin"] {
		if strings.Contains(n.Href, "guide=legacy-team&revision=3") {
			count++
		}
	}
	if count != 1 {
		t.Fatalf("expected one moderation notice, got %d", count)
	}
	for _, g := range state.Guides {
		if g.ID == "demo-v1-team-guide" && g.Status != models.StatusPublished {
			t.Fatal("already reviewed publication changed")
		}
	}
	job, err := db.NextModerationJob()
	if err != nil || job == nil || job.Guide.ID != guide.ID {
		t.Fatal("missing legacy job", err)
	}
	if err = db.RecordModeration(*job, "busy", ""); err != nil {
		t.Fatal(err)
	}
	state, err = db.loadState(nil)
	if err != nil {
		t.Fatal(err)
	}
	attempt := state.AutoReviews[guide.ID]
	if attempt.ManualNote != "" || attempt.Failures != 0 || attempt.RetryAt <= time.Now().Unix() {
		t.Fatal("busy worker failed the submission")
	}
}
