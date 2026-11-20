package provider

import (
	"context"
	"errors"
	"time"
)

var ErrBusy = errors.New("локальная модель занята")

var localSlot = make(chan struct{}, 1)
var localWaiters = make(chan struct{}, 3)

// Acquire shares the local GPU across chat, search, drafts and moderation.
func Acquire(ctx context.Context, local bool) (func(), error) {
	if !local {
		return func() {}, nil
	}
	release := func() { <-localSlot }
	select {
	case localSlot <- struct{}{}:
		return release, nil
	default:
	}
	select {
	case localWaiters <- struct{}{}:
		defer func() { <-localWaiters }()
	default:
		return nil, ErrBusy
	}
	timer := time.NewTimer(25 * time.Second)
	defer timer.Stop()
	select {
	case localSlot <- struct{}{}:
		return release, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-timer.C:
		return nil, ErrBusy
	}
}
