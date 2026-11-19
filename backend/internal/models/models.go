package models

import "strings"

type PublicationStatus string

const (
	StatusDraft     PublicationStatus = "draft"
	StatusPending   PublicationStatus = "pending"
	StatusPublished PublicationStatus = "published"
	StatusRejected  PublicationStatus = "rejected"
)

type Vote string

const (
	VoteHelpful   Vote = "helpful"
	VoteUnhelpful Vote = "unhelpful"
)

type Profile struct {
	Plan   string `json:"plan,omitempty"`
	ID     string `json:"id,omitempty"`
	Name   string `json:"name"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	Avatar string `json:"avatar,omitempty"`
	Bio    string `json:"bio,omitempty"`
}

type Step struct {
	ImageURL string   `json:"imageUrl,omitempty"`
	VideoURL string   `json:"videoUrl,omitempty"`
	ID       string   `json:"id"`
	Title    string   `json:"title"`
	Text     string   `json:"text"`
	Code     *string  `json:"code,omitempty"`
	Filename *string  `json:"filename,omitempty"`
	Checks   []string `json:"checks"`
}

type SourceRef struct {
	ID     string `json:"id"`
	Title  string `json:"title"`
	Author string `json:"author"`
}

type Instruction struct {
	TeamID         string            `json:"teamId,omitempty"`
	Revision       int               `json:"revision,omitempty"`
	Cover          string            `json:"cover,omitempty"`
	ID             string            `json:"id"`
	Title          string            `json:"title"`
	Description    string            `json:"description"`
	Category       string            `json:"category"`
	Minutes        int               `json:"minutes"`
	Author         string            `json:"author"`
	Status         PublicationStatus `json:"status"`
	Owned          bool              `json:"owned,omitempty"`
	OwnerID        string            `json:"ownerId,omitempty"`
	Steps          []Step            `json:"steps"`
	Source         *SourceRef        `json:"source,omitempty"`
	ModerationNote string            `json:"moderationNote,omitempty"`
	SubmittedAt    string            `json:"submittedAt,omitempty"`
	ReviewedAt     string            `json:"reviewedAt,omitempty"`
	ReviewedBy     string            `json:"reviewedBy,omitempty"`
}

type StepComment struct {
	ID         string `json:"id"`
	GuideID    string `json:"guideId"`
	StepID     string `json:"stepId"`
	AuthorID   string `json:"authorId"`
	AuthorName string `json:"authorName"`
	Text       string `json:"text"`
	CreatedAt  string `json:"createdAt"`
}

type Report struct {
	Reply    string `json:"reply,omitempty"`
	ID       string `json:"id"`
	GuideID  string `json:"guideId"`
	StepID   string `json:"stepId"`
	Text     string `json:"text"`
	AuthorID string `json:"authorId,omitempty"`
}

type ExpertReview struct {
	GuideID    string `json:"guideId"`
	ExpertID   string `json:"expertId"`
	ExpertName string `json:"expertName"`
	Verified   bool   `json:"verified"`
	Text       string `json:"text"`
	CreatedAt  string `json:"createdAt"`
}

type Run struct {
	Current    int               `json:"current"`
	Checked    map[string][]bool `json:"checked"`
	Completed  []string          `json:"completed"`
	Visited    []string          `json:"visited,omitempty"`
	LastStepID string            `json:"lastStepId,omitempty"`
	UpdatedAt  int64             `json:"updatedAt,omitempty"`
}

func DefaultRun() Run {
	return Run{
		Current:   0,
		Checked:   make(map[string][]bool),
		Completed: []string{},
		Visited:   []string{},
	}
}

type StepMetric struct {
	StepID          string `json:"stepId"`
	Started         int    `json:"started"`
	Completed       int    `json:"completed"`
	Stopped         int    `json:"stopped"`
	Questions       int    `json:"questions"`
	QuestionAuthors int    `json:"questionAuthors"`
}

type GuideMetrics struct {
	Started   int          `json:"started"`
	Completed int          `json:"completed"`
	Reports   []Report     `json:"reports"`
	Steps     []StepMetric `json:"steps"`
}

type WorkspaceData struct {
	Teams     []TeamSummary              `json:"teams"`
	Notices   []Notice                   `json:"notices"`
	Guides    []Instruction              `json:"guides"`
	Runs      map[string]Run             `json:"runs"`
	Votes     map[string]map[string]Vote `json:"votes"`
	Comments  []StepComment              `json:"comments"`
	Reviews   []ExpertReview             `json:"reviews"`
	Analytics map[string]GuideMetrics    `json:"analytics"`
}

type WorkspaceSnapshot struct {
	Profile *Profile      `json:"profile"`
	Data    WorkspaceData `json:"data"`
}

type CommandResult struct {
	Profile *Profile      `json:"profile"`
	Data    WorkspaceData `json:"data"`
	ID      string        `json:"id,omitempty"`
	Count   *int          `json:"count,omitempty"`
}

type State struct {
	Teams    []Team                       `json:"teams"`
	Notices  map[string][]Notice          `json:"notices"`
	Accounts map[string]Profile           `json:"accounts"`
	Guides   []Instruction                `json:"guides"`
	Runs     map[string]map[string]Run    `json:"runs"`
	Votes    map[string]map[string]Vote   `json:"votes"`
	Comments []StepComment                `json:"comments"`
	Reports  []Report                     `json:"reports"`
	Reviews  []ExpertReview               `json:"reviews"`
	Imports  map[string]map[string]string `json:"imports"`
}

func ActorID(p Profile) string {
	if p.ID != "" {
		return p.ID
	}
	email := strings.TrimSpace(strings.ToLower(p.Email))
	if email != "" {
		return "local:" + email
	}
	name := strings.TrimSpace(p.Name)
	if name != "" {
		return "local:" + name
	}
	return "local:anonymous"
}

func IsAdmin(p *Profile) bool {
	return p != nil && p.Role == "Администратор"
}

func IsExpert(p *Profile) bool {
	return p != nil && p.Role == "Эксперт" && (p.Plan == "standard" || p.Plan == "business")
}

func IsOwner(guide Instruction, p *Profile) bool {
	return p != nil && guide.Owned && guide.OwnerID == ActorID(*p)
}

func CanView(guide Instruction, p *Profile) bool {
	return guide.Status == StatusPublished ||
		IsOwner(guide, p) ||
		(IsAdmin(p) && (guide.Status == StatusPending || guide.Status == StatusRejected))
}

type Team struct {
	ID        string   `json:"id"`
	OwnerID   string   `json:"ownerId"`
	Name      string   `json:"name"`
	MemberIDs []string `json:"memberIds"`
	Active    bool     `json:"active"`
}
type TeamSummary struct {
	Team
	Members []TeamMember `json:"members"`
}
type TeamMember struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}
type Notice struct {
	ID        string `json:"id"`
	Text      string `json:"text"`
	Href      string `json:"href"`
	Read      bool   `json:"read"`
	CreatedAt string `json:"createdAt"`
}
