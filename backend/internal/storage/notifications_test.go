package storage

import (
	"encoding/json"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"stepflow/backend/internal/models"
)

func TestNoticeDeliveryAcrossAccounts(t *testing.T) {
	t.Setenv("STEPFLOW_DEMO_DATA", "1")
	db, err := New(filepath.Join(t.TempDir(), "notifications.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	login := func(name string) string {
		t.Helper()
		body, _ := json.Marshal(map[string]string{"type": "login", "email": name + "@stepflow.test"})
		_, token, err := db.ChangeWorkspace("", body)
		if err != nil {
			t.Fatal(err)
		}
		return *token
	}
	owner, reader, expert, admin := login("member"), login("learner"), login("expert"), login("admin")
	type command = map[string]any
	send := func(token string, action command) {
		t.Helper()
		body, err := json.Marshal(action)
		if err != nil {
			t.Fatal(err)
		}
		if _, _, err := db.ChangeWorkspace(token, body); err != nil {
			t.Fatal(err)
		}
	}
	inbox := func(token string) []models.Notice {
		t.Helper()
		snapshot, err := db.ReadWorkspace(token)
		if err != nil {
			t.Fatal(err)
		}
		return snapshot.Data.Notices
	}
	comment := func(token, guide, step string) {
		t.Helper()
		send(token, command{"type": "comment", "guideId": guide, "stepId": "demo-v1-step-" + step, "text": "Комментарий"})
	}
	t.Run("catalog votes and article views", func(t *testing.T) {
		const guideID = "demo-catalog-binary"
		const commentID = "demo-binary-comment-2"
		snapshot := func(token string) *models.WorkspaceSnapshot {
			snapshot, err := db.ReadWorkspace(token)
			if err != nil {
				t.Fatal(err)
			}
			return snapshot
		}
		before := snapshot(owner).Data.Analytics[guideID]
		for range 2 {
			send(admin, command{"type": "view", "guideId": guideID})
		}
		send(admin, command{"type": "visit", "guideId": guideID, "stepId": "prepare"})
		after := snapshot(owner).Data.Analytics[guideID]
		if after.Views != before.Views+1 || after.Comments != 3 {
			t.Fatal("unexpected article counts", after.ArticleCounts)
		}
		if _, ok := snapshot(reader).Data.Analytics[guideID]; ok {
			t.Fatal("reader received owner metrics")
		}
		for _, vote := range []string{"helpful", "helpful", "unhelpful", ""} {
			send(admin, command{"type": "comment-vote", "guideId": guideID, "commentId": commentID, "value": vote})
			comments := snapshot(admin).Data.Comments
			i := slices.IndexFunc(comments, func(c models.StepComment) bool { return c.ID == commentID })
			if i < 0 {
				t.Fatal("missing comment")
			}
			c := comments[i]
			likes, dislikes := 0, 0
			if vote == "helpful" {
				likes = 1
			}
			if vote == "unhelpful" {
				dislikes = 1
			}
			if c.Likes != likes || c.Dislikes != dislikes || string(c.MyVote) != vote || c.Reactions != nil {
				t.Fatal("wrong reaction summary", c)
			}
		}
		posts := snapshot(admin).Data.Moderation.Posts
		i := slices.IndexFunc(posts, func(p models.PostStats) bool { return p.ID == guideID })
		if i < 0 || posts[i].ArticleCounts != after.ArticleCounts {
			t.Fatal("admin and owner metrics differ")
		}
	})
	t.Run("step participants and unread race", func(t *testing.T) {
		const guide = "demo-v1-published"
		comment(expert, guide, "3")
		comment(reader, guide, "1")
		comment(reader, guide, "1")
		before, own, unrelated := inbox(reader), inbox(owner), inbox(expert)
		comment(owner, guide, "1")
		after := inbox(reader)
		if len(after) != len(before)+1 || !strings.Contains(after[0].Href, "step=demo-v1-step-1#comment-") {
			t.Fatal("participant did not receive exactly one link to the comment")
		}
		if len(inbox(owner)) != len(own) || len(inbox(expert)) != len(unrelated) {
			t.Fatal("notified sender or a participant in another step")
		}
		ids := []string{}
		for _, n := range before {
			if !n.Read {
				ids = append(ids, n.ID)
			}
		}
		send(reader, command{"type": "notices-read", "ids": ids})
		now := inbox(reader)
		if now[0].Read || slices.ContainsFunc(now[1:], func(n models.Notice) bool { return !n.Read }) {
			t.Fatal("bulk read must apply to the displayed snapshot only")
		}
	})
	t.Run("mention teammate on a new step", func(t *testing.T) {
		send(reader, command{"type": "profile", "edits": command{"name": "Маша", "email": "learner@stepflow.test", "username": "masha"}})
		before := len(inbox(reader))
		action := command{"type": "comment", "guideId": "demo-v1-published", "stepId": "demo-v1-step-3", "text": "mail@masha.ru"}
		send(owner, action)
		if len(inbox(reader)) != before {
			t.Fatal("email produced a mention")
		}
		action["text"] = "@Masha, посмотри, @masha"
		send(owner, action)
		after := inbox(reader)
		if len(after) != before+1 || !strings.Contains(after[0].Text, "зовёт тебя") || !strings.Contains(after[0].Href, "step=demo-v1-step-3#comment-") {
			t.Fatal("expected one mention with the step and comment link")
		}
	})
	t.Run("team access and removal", func(t *testing.T) {
		const guide = "demo-v1-team-guide"
		before, outside := inbox(reader), inbox(admin)
		send(owner, command{"type": "plan", "plan": "free"})
		send(owner, command{"type": "plan", "plan": "free"})
		send(owner, command{"type": "plan", "plan": "business"})
		now := inbox(reader)
		if len(now) != len(before)+2 || now[0].Href != "/team/overview?id=demo-v1-team" || len(inbox(admin)) != len(outside) {
			t.Error("missing, duplicate or misdirected team access notices")
		}
		comment(reader, guide, "1")
		send(owner, command{"type": "team-member", "teamId": "demo-v1-team", "memberId": "demo-v1-learner", "remove": true})
		removed := inbox(reader)
		comment(expert, guide, "1")
		send(owner, command{"type": "delete-guide", "guideId": guide, "status": "published", "revision": 1})
		if inbox(reader)[0].ID != removed[0].ID || inbox(expert)[0].Href != "/team/overview?id=demo-v1-team" {
			t.Error("incorrect delivery after a member or guide was removed")
		}
	})
}

func TestUnreadNoticeSurvivesHistoryLimit(t *testing.T) {
	state := &models.State{}
	notify(state, "reader", "author", "first", "/catalog")
	for range 200 {
		notify(state, "reader", "author", "later", "/catalog")
	}
	if len(state.Notices["reader"]) != 201 {
		t.Fatal("oldest unread notice disappeared")
	}
}
