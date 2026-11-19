package provider

import "os"

// Configured reports whether all required chat-completions settings are present.
func Configured() bool {
	return os.Getenv("AI_BASE_URL") != "" && os.Getenv("AI_API_KEY") != "" && os.Getenv("AI_MODEL") != ""
}
