package storage

import (
	"path/filepath"
	"testing"
)

func TestDemoSeedIsIdempotent(t *testing.T) {
	t.Setenv("STEPFLOW_DEMO_DATA", "1")
	s, err := New(filepath.Join(t.TempDir(), "demo.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	before, err := s.loadState(nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(before.Accounts) != 4 || len(before.Teams) != 1 || len(before.Reports) != 1 {
		t.Fatal("demo data missing")
	}
	if err = s.seedDemo(); err != nil {
		t.Fatal(err)
	}
	after, err := s.loadState(nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(before.Guides) != len(after.Guides) || len(after.Accounts) != 4 {
		t.Fatal("demo data duplicated")
	}
}
