package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"strings"
	"time"

	"web-ui/internal/models"
)

// LLMProvider represents different LLM providers
type LLMProvider string

const (
	ProviderGemini LLMProvider = "gemini"
	ProviderOpenAI LLMProvider = "openai"
	ProviderClaude LLMProvider = "claude"
)

// LLMConfig holds configuration for different LLM providers
type LLMConfig struct {
	Provider    LLMProvider
	APIKey      string
	Model       string
	BaseURL     string
	MaxTokens   int
	Temperature float64
}

// AIService handles AI-powered code review and interview simulation
type AIService struct {
	config     LLMConfig
	httpClient *http.Client
}

// NewAIService creates a new AI service with the specified provider
func NewAIService() *AIService {
	cfgProvider := getProviderFromEnv()
	config := LLMConfig{
		Provider:    cfgProvider,
		APIKey:      getAPIKeyFromEnvFor(cfgProvider),
		Model:       getModelFromEnv(),
		MaxTokens:   4000, // Increased for longer responses
		Temperature: 0.3,
	}

	// Set provider-specific defaults
	switch config.Provider {
	case ProviderGemini:
		config.BaseURL = "https://generativelanguage.googleapis.com/v1beta/models"
		if config.Model == "" {
			config.Model = "gemini-2.5-flash"
		}
	case ProviderOpenAI:
		config.BaseURL = "https://api.openai.com/v1/chat/completions"
		if config.Model == "" {
			// Use a modern default that supports structured outputs well
			config.Model = "gpt-4o-mini"
		}
	case ProviderClaude:
		config.BaseURL = "https://api.anthropic.com/v1/messages"
		if config.Model == "" {
			config.Model = "claude-3-sonnet-20240229"
		}
	default:
		// Default to Gemini if provider is not recognized
		config.Provider = ProviderGemini
		config.BaseURL = "https://generativelanguage.googleapis.com/v1beta/models"
		if config.Model == "" {
			config.Model = "gemini-2.5-flash"
		}
	}

	return &AIService{
		config: config,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Helper functions to get configuration from environment
func getProviderFromEnv() LLMProvider {
	provider := strings.ToLower(os.Getenv("AI_PROVIDER"))
	switch provider {
	case "gemini":
		return ProviderGemini
	case "openai":
		return ProviderOpenAI
	case "claude":
		return ProviderClaude
	default:
		return ProviderGemini // Default to Gemini
	}
}

func getAPIKeyFromEnvFor(provider LLMProvider) string {
	switch provider {
	case ProviderGemini:
		if key := os.Getenv("GEMINI_API_KEY"); key != "" {
			return key
		}
	case ProviderOpenAI:
		if key := os.Getenv("OPENAI_API_KEY"); key != "" {
			return key
		}
	case ProviderClaude:
		if key := os.Getenv("CLAUDE_API_KEY"); key != "" {
			return key
		}
	}
	// Fall back to generic AI_API_KEY
	return os.Getenv("AI_API_KEY")
}

func getModelFromEnv() string {
	return os.Getenv("AI_MODEL")
}

// AICodeReview represents the response from AI code review
type AICodeReview struct {
	OverallScore        float64            `json:"overall_score"`        // 0-100 score
	Issues              []CodeIssue        `json:"issues"`               // Code quality issues
	Suggestions         []CodeSuggestion   `json:"suggestions"`          // Improvement suggestions
	InterviewerFeedback string             `json:"interviewer_feedback"` // What an interviewer would say
	FollowUpQuestions   []string           `json:"follow_up_questions"`  // Questions to ask the candidate
	Complexity          ComplexityAnalysis `json:"complexity"`           // Time/space complexity analysis
	ReadabilityScore    float64            `json:"readability_score"`    // 0-100 readability score
	TestCoverage        string             `json:"test_coverage"`        // Coverage assessment
}

// CodeIssue represents a specific issue in the code
type CodeIssue struct {
	Type        string `json:"type"`        // "bug", "performance", "style", "logic"
	Severity    string `json:"severity"`    // "low", "medium", "high", "critical"
	LineNumber  int    `json:"line_number"` // Approximate line number
	Description string `json:"description"` // Human-readable description
	Solution    string `json:"solution"`    // Suggested fix
}

// CodeSuggestion represents an improvement suggestion
type CodeSuggestion struct {
	Category    string `json:"category"`    // "optimization", "best_practice", "alternative"
	Priority    string `json:"priority"`    // "low", "medium", "high"
	Description string `json:"description"` // What to improve
	Example     string `json:"example"`     // Code example if applicable
}

// ComplexityAnalysis represents time/space complexity analysis
type ComplexityAnalysis struct {
	TimeComplexity    string `json:"time_complexity"`    // "O(n)", "O(log n)", etc.
	SpaceComplexity   string `json:"space_complexity"`   // "O(1)", "O(n)", etc.
	CanOptimize       bool   `json:"can_optimize"`       // Whether it can be optimized
	OptimizedApproach string `json:"optimized_approach"` // How to optimize
}

// Universal request/response structures for different LLM providers

// GeminiRequest represents the request structure for Gemini API
type GeminiRequest struct {
	Contents         []GeminiContent         `json:"contents"`
	GenerationConfig *GeminiGenerationConfig `json:"generationConfig,omitempty"`
}

type GeminiContent struct {
	Parts []GeminiPart `json:"parts"`
}

type GeminiPart struct {
	Text string `json:"text"`
}

type GeminiGenerationConfig struct {
	Temperature     *float64 `json:"temperature,omitempty"`
	MaxOutputTokens *int     `json:"maxOutputTokens,omitempty"`
	ResponseMIME    string   `json:"responseMimeType,omitempty"`
}

// GeminiResponse represents the response from Gemini API
type GeminiResponse struct {
	Candidates []GeminiCandidate `json:"candidates"`
	Error      *GeminiError      `json:"error,omitempty"`
}

type GeminiCandidate struct {
	Content GeminiContent `json:"content"`
}

type GeminiError struct {
	Message string `json:"message"`
	Code    int    `json:"code"`
}

// ClaudeRequest represents the request structure for Claude API
type ClaudeRequest struct {
	Model       string          `json:"model"`
	Messages    []ClaudeMessage `json:"messages"`
	MaxTokens   int             `json:"max_tokens"`
	Temperature float64         `json:"temperature"`
}

type ClaudeMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ClaudeResponse represents the response from Claude API
type ClaudeResponse struct {
	Content []ClaudeContent `json:"content"`
	Error   *ClaudeError    `json:"error,omitempty"`
}

type ClaudeContent struct {
	Text string `json:"text"`
	Type string `json:"type"`
}

type ClaudeError struct {
	Message string `json:"message"`
	Type    string `json:"type"`
}

// OpenAIRequest represents the request structure for OpenAI API
type OpenAIRequest struct {
	Model          string                `json:"model"`
	Messages       []Message             `json:"messages"`
	MaxTokens      int                   `json:"max_tokens"`
	Temperature    float64               `json:"temperature"`
	ResponseFormat *OpenAIResponseFormat `json:"response_format,omitempty"`
}

// Message represents a message in the OpenAI chat
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// OpenAIResponse represents the response from OpenAI API
type OpenAIResponse struct {
	Choices []Choice     `json:"choices"`
	Error   *OpenAIError `json:"error,omitempty"`
}

// Choice represents a choice in OpenAI response
type Choice struct {
	Message Message `json:"message"`
}

// OpenAIError represents an error from OpenAI API
type OpenAIError struct {
	Message string `json:"message"`
	Type    string `json:"type"`
}

// ReviewCode performs AI-powered code review
func (ai *AIService) ReviewCode(code string, challenge *models.Challenge, context string) (*AICodeReview, error) {

	if ai.config.APIKey == "" {
		return &AICodeReview{
			OverallScore:        0,
			Issues:              []CodeIssue{},
			Suggestions:         []CodeSuggestion{},
			InterviewerFeedback: "⚠️ AI features require an API key. Please add GEMINI_API_KEY to your .env file. Get your free key at: https://makersuite.google.com/app/apikey",
			FollowUpQuestions:   []string{"Would you like to set up AI code review?"},
			Complexity: ComplexityAnalysis{
				TimeComplexity:    "N/A",
				SpaceComplexity:   "N/A",
				CanOptimize:       false,
				OptimizedApproach: "Set up your API key first",
			},
			ReadabilityScore: 0,
			TestCoverage:     "API key required for AI analysis",
		}, nil
	}

	prompt := ai.buildCodeReviewPrompt(code, challenge, context)

	response, err := ai.callLLMWithOpts(prompt, true /* expectJSON */)
	if err != nil {
		return &AICodeReview{
			OverallScore:        0,
			Issues:              []CodeIssue{},
			Suggestions:         []CodeSuggestion{},
			InterviewerFeedback: fmt.Sprintf("❌ AI service temporarily unavailable: %v. Please try again later.", err),
			FollowUpQuestions:   []string{"Would you like to try again?"},
			Complexity: ComplexityAnalysis{
				TimeComplexity:    "N/A",
				SpaceComplexity:   "N/A",
				CanOptimize:       false,
				OptimizedApproach: "API service temporarily unavailable",
			},
			ReadabilityScore: 0,
			TestCoverage:     "AI service unavailable",
		}, nil
	}

	review, err := ai.parseAIResponse(response)
	if err != nil {
		// This shouldn't happen anymore since parseAIResponse returns fallback instead of error
		return ai.createFallbackReview("Unexpected parsing error", response), nil
	}

	return review, nil
}

// GetInterviewerQuestions generates follow-up questions based on code
func (ai *AIService) GetInterviewerQuestions(code string, challenge *models.Challenge, userProgress string) ([]string, error) {
	if ai.config.APIKey == "" {
		return []string{"⚠️ AI features require an API key. Get your free key at: https://makersuite.google.com/app/apikey"}, nil
	}

	prompt := ai.buildQuestionPrompt(code, challenge, userProgress)

	response, err := ai.callLLMWithOpts(prompt, true /* expectJSON */)
	if err != nil {
		return []string{fmt.Sprintf("❌ AI service unavailable: %v", err)}, nil
	}

	questions := ai.parseQuestions(response)
	return questions, nil
}

// GetCodeHint provides context-aware hints
func (ai *AIService) GetCodeHint(code string, challenge *models.Challenge, hintLevel int, context string) (string, error) {
	if ai.config.APIKey == "" {
		return "⚠️ AI features require an API key. Get your free key at: https://makersuite.google.com/app/apikey", nil
	}

	prompt := ai.buildHintPrompt(code, challenge, hintLevel, context)

	response, err := ai.callLLMWithOpts(prompt, false /* expectJSON */)
	if err != nil {
		return fmt.Sprintf("❌ AI service unavailable: %v", err), nil
	}

	return ai.parseHint(response), nil
}

// ChatMessage represents a single chat message
type ChatMessage struct {
	Role      string `json:"role"`      // "user" or "assistant"
	Content   string `json:"content"`   // The message content
	Timestamp string `json:"timestamp"` // ISO timestamp
}

// ChatResponse represents the response from AI chat
type ChatResponse struct {
	Message     string   `json:"message"`     // The AI's response
	Success     bool     `json:"success"`     // Whether the request was successful
	Error       string   `json:"error"`       // Error message if any
	Timestamp   string   `json:"timestamp"`   // ISO timestamp
	Context     string   `json:"context"`     // Optional context about the response
	Suggestions []string `json:"suggestions"` // Optional follow-up suggestions
}

// ChatWithMentor handles conversational chat with the AI mentor
func (ai *AIService) ChatWithMentor(userMessage string, challenge *models.Challenge, conversationHistory []ChatMessage, codeContext string) (*ChatResponse, error) {
	if ai.config.APIKey == "" {
		return &ChatResponse{
			Message:   "⚠️ AI chat requires an API key. Get your free key at: https://makersuite.google.com/app/apikey",
			Success:   false,
			Error:     "API key not configured",
			Timestamp: getCurrentTimestamp(),
		}, nil
	}

	prompt := ai.buildChatPrompt(userMessage, challenge, conversationHistory, codeContext)

	response, err := ai.callLLMWithOpts(prompt, false /* expectJSON */)
	if err != nil {
		return &ChatResponse{
			Message:   "❌ I'm having trouble connecting right now. Please try again in a moment.",
			Success:   false,
			Error:     err.Error(),
			Timestamp: getCurrentTimestamp(),
		}, nil
	}

	// Parse the response and potentially extract suggestions
	parsedResponse := ai.parseChatResponse(response)

	return &ChatResponse{
		Message:     parsedResponse,
		Success:     true,
		Timestamp:   getCurrentTimestamp(),
		Context:     getContextDescription(challenge),
		Suggestions: ai.generateFollowUpSuggestions(userMessage, parsedResponse, challenge),
	}, nil
}

// BuildCodeReviewPrompt exposes the prompt builder for debugging
func (ai *AIService) BuildCodeReviewPrompt(code string, challenge *models.Challenge, context string) string {
	return ai.buildCodeReviewPrompt(code, challenge, context)
}

// CallLLMRaw calls the LLM and returns raw response for debugging
func (ai *AIService) CallLLMRaw(prompt string) (string, error) {
	return ai.callLLMWithOpts(prompt, true)
}

// buildCodeReviewPrompt creates the prompt for code review
func (ai *AIService) buildCodeReviewPrompt(code string, challenge *models.Challenge, context string) string {
	return fmt.Sprintf(`You are a senior Go interviewer. Respond ONLY with a single JSON object. Do NOT include markdown or code fences. All numeric fields must be JSON numbers, not strings.

SCHEMA:
{
  "overall_score": integer (0..100),
  "issues": [
    {
      "type": "bug|performance|style|logic",
      "severity": "low|medium|high|critical",
      "line_number": integer,
      "description": string,
      "solution": string
    }
  ],
  "suggestions": [
    {
      "category": "optimization|best_practice|alternative",
      "priority": "low|medium|high",
      "description": string,
      "example": string
    }
  ],
  "interviewer_feedback": string,
  "follow_up_questions": [string],
  "complexity": {
    "time_complexity": string,
    "space_complexity": string,
    "can_optimize": boolean,
    "optimized_approach": string
  },
  "readability_score": integer (0..100),
  "test_coverage": string
}

CHALLENGE: %s
CONTEXT: %s

CODE (Go):
BEGIN_CODE
%s
END_CODE

Focus on: (1) correctness and edge cases, (2) Go idioms, (3) performance, (4) readability, (5) interviewer follow-ups.`, challenge.Title, context, code)
}

// buildQuestionPrompt creates the prompt for generating interview questions
func (ai *AIService) buildQuestionPrompt(code string, challenge *models.Challenge, userProgress string) string {
	return fmt.Sprintf(`You are a technical interviewer. Respond ONLY with a JSON array of strings. No markdown, no prose outside the array.

CHALLENGE: %s
USER PROGRESS: %s

CODE (Go):
BEGIN_CODE
%s
END_CODE

Generate 3-5 follow-up questions that probe: deeper understanding, edge cases, optimizations, Go-specific concepts, and trade-offs.`, challenge.Title, userProgress, code)
}

// buildHintPrompt creates the prompt for generating hints
func (ai *AIService) buildHintPrompt(code string, challenge *models.Challenge, hintLevel int, context string) string {
	hintTypes := map[int]string{
		1: "a subtle nudge in the right direction",
		2: "a more direct hint about the approach",
		3: "a specific suggestion about implementation",
		4: "a detailed explanation with partial code example",
	}

	// Use context if provided, otherwise fall back to challenge title
	challengeInfo := challenge.Title
	if context != "" {
		challengeInfo = context
	}

	return fmt.Sprintf(`You are a helpful coding mentor. Return only the hint text as plain text. No JSON, no code fences.

CHALLENGE CONTEXT: %s
CURRENT CODE:
%s

Provide %s (level %d/4). Be encouraging and educational, not just giving the answer.

Important: Use the CHALLENGE CONTEXT above to understand what specific challenge the student is working on. If it mentions a specific framework (like Gin, GORM, Cobra), provide hints specific to that framework.

Return only the hint text.`, challengeInfo, code, hintTypes[hintLevel], hintLevel)
}

// callLLM makes a request to the configured LLM provider
func (ai *AIService) callLLM(prompt string) (string, error) {
	return ai.callLLMWithOpts(prompt, false)
}

// callLLMWithOpts allows specifying whether JSON output is expected (to enforce provider features)
func (ai *AIService) callLLMWithOpts(prompt string, expectJSON bool) (string, error) {
	switch ai.config.Provider {
	case ProviderGemini:
		return ai.callGeminiWithOpts(prompt, expectJSON)
	case ProviderOpenAI:
		return ai.callOpenAIWithOpts(prompt, expectJSON)
	case ProviderClaude:
		return ai.callClaudeWithOpts(prompt, expectJSON)
	default:
		return "", fmt.Errorf("unsupported provider: %s", ai.config.Provider)
	}
}

// callGemini makes a request to the Gemini API
func (ai *AIService) callGeminiWithOpts(prompt string, expectJSON bool) (string, error) {
	url := fmt.Sprintf("%s/%s:generateContent?key=%s", ai.config.BaseURL, ai.config.Model, ai.config.APIKey)

	requestBody := GeminiRequest{
		Contents: []GeminiContent{
			{
				Parts: []GeminiPart{
					{Text: prompt},
				},
			},
		},
		GenerationConfig: &GeminiGenerationConfig{
			Temperature:     &ai.config.Temperature,
			MaxOutputTokens: &ai.config.MaxTokens,
			ResponseMIME: func() string {
				if expectJSON {
					return "application/json"
				}
				return ""
			}(),
		},
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := ai.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var geminiResp GeminiResponse
	err = json.Unmarshal(body, &geminiResp)
	if err != nil {
		return "", err
	}

	if geminiResp.Error != nil {
		return "", fmt.Errorf("Gemini API error: %s", geminiResp.Error.Message)
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("no response from Gemini")
	}

	return geminiResp.Candidates[0].Content.Parts[0].Text, nil
}

// callClaude makes a request to the Claude API
// Claude Messages API requires content blocks and benefits from a system message
type claudeContentBlock struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type claudeMessage struct {
	Role    string               `json:"role"`
	Content []claudeContentBlock `json:"content"`
}

func (ai *AIService) callClaudeWithOpts(prompt string, expectJSON bool) (string, error) {
	systemText := "You are a senior Go interviewer. Be concise."
	if expectJSON {
		systemText += " Respond ONLY with strict JSON. No markdown."
	}
	requestBody := struct {
		Model       string          `json:"model"`
		Messages    []claudeMessage `json:"messages"`
		MaxTokens   int             `json:"max_tokens"`
		Temperature float64         `json:"temperature"`
	}{
		Model: ai.config.Model,
		Messages: []claudeMessage{
			{Role: "system", Content: []claudeContentBlock{{Type: "text", Text: systemText}}},
			{Role: "user", Content: []claudeContentBlock{{Type: "text", Text: prompt}}},
		},
		MaxTokens:   ai.config.MaxTokens,
		Temperature: ai.config.Temperature,
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest("POST", ai.config.BaseURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", ai.config.APIKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := ai.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var claudeResp ClaudeResponse
	err = json.Unmarshal(body, &claudeResp)
	if err != nil {
		return "", err
	}

	if claudeResp.Error != nil {
		return "", fmt.Errorf("Claude API error: %s", claudeResp.Error.Message)
	}

	if len(claudeResp.Content) == 0 {
		return "", fmt.Errorf("no response from Claude")
	}

	return claudeResp.Content[0].Text, nil
}

// callOpenAI makes a request to the OpenAI API
type OpenAIResponseFormat struct {
	Type string `json:"type"`
}

func (ai *AIService) callOpenAIWithOpts(prompt string, expectJSON bool) (string, error) {
	// Add a system message to better steer responses
	messages := []Message{
		{Role: "system", Content: func() string {
			if expectJSON {
				return "You are a senior Go interviewer. Respond ONLY with strict JSON. No markdown."
			}
			return "You are a senior Go interviewer."
		}()},
		{Role: "user", Content: prompt},
	}

	requestBody := OpenAIRequest{
		Model:       ai.config.Model,
		Messages:    messages,
		MaxTokens:   ai.config.MaxTokens,
		Temperature: ai.config.Temperature,
	}
	if expectJSON {
		// Only force json_object when the prompt expects a single JSON object, not an array
		if strings.Contains(strings.ToLower(prompt), "single json object") {
			requestBody.ResponseFormat = &OpenAIResponseFormat{Type: "json_object"}
		}
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest("POST", ai.config.BaseURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+ai.config.APIKey)

	resp, err := ai.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var openAIResp OpenAIResponse
	err = json.Unmarshal(body, &openAIResp)
	if err != nil {
		return "", err
	}

	if openAIResp.Error != nil {
		return "", fmt.Errorf("OpenAI API error: %s", openAIResp.Error.Message)
	}

	if len(openAIResp.Choices) == 0 {
		return "", fmt.Errorf("no response from OpenAI")
	}

	return openAIResp.Choices[0].Message.Content, nil
}

// parseAIResponse parses the AI response into a structured review
func (ai *AIService) parseAIResponse(response string) (*AICodeReview, error) {
	// Remove markdown code blocks if present
	response = strings.TrimSpace(response)
	response = strings.TrimPrefix(response, "```json")
	response = strings.TrimPrefix(response, "```")
	response = strings.TrimSuffix(response, "```")
	response = strings.TrimSpace(response)

	// Try to extract JSON from the response
	start := strings.Index(response, "{")
	end := strings.LastIndex(response, "}")

	if start == -1 || end == -1 {
		// Log the raw response for debugging
		fmt.Printf("AI Response parsing failed - no JSON braces found. Raw response: %s\n", response)
		return ai.createFallbackReview("No JSON found in AI response", response), nil
	}

	jsonStr := response[start : end+1]

	// Check if JSON is complete by counting braces
	openBraces := strings.Count(jsonStr, "{")
	closeBraces := strings.Count(jsonStr, "}")
	if openBraces != closeBraces {
		fmt.Printf("AI Response parsing failed - mismatched braces. JSON: %s\n", jsonStr)
		return ai.createFallbackReview("Incomplete JSON response", jsonStr), nil
	}

	var review AICodeReview
	err := json.Unmarshal([]byte(jsonStr), &review)
	if err != nil {
		fmt.Printf("AI Response JSON unmarshal error: %v. JSON: %s\n", err, jsonStr)
		return ai.createFallbackReview("JSON parsing error", jsonStr), nil
	}

	// Validate critical fields and provide defaults
	if review.OverallScore == 0 && review.ReadabilityScore == 0 && review.InterviewerFeedback == "" {
		fmt.Printf("AI Response appears incomplete - all key fields empty. JSON: %s\n", jsonStr)
		return ai.createFallbackReview("Incomplete AI response", jsonStr), nil
	}

	return &review, nil
}

// createFallbackReview creates a reasonable fallback when AI parsing fails
func (ai *AIService) createFallbackReview(reason, rawResponse string) *AICodeReview {
	// Try to extract any useful text from the response
	feedback := rawResponse
	if len(feedback) > 500 {
		feedback = feedback[:500] + "..."
	}
	if feedback == "" {
		feedback = "AI provided an empty or malformed response. Please try again."
	}

	return &AICodeReview{
		OverallScore: 50, // Neutral score
		Issues: []CodeIssue{
			{
				Type:        "parsing",
				Severity:    "medium",
				LineNumber:  0,
				Description: fmt.Sprintf("AI response parsing issue: %s", reason),
				Solution:    "Try running the AI review again, or check your code for syntax issues.",
			},
		},
		Suggestions: []CodeSuggestion{
			{
				Category:    "troubleshooting",
				Priority:    "medium",
				Description: "If this keeps happening, try simplifying your code or breaking it into smaller functions.",
				Example:     "",
			},
		},
		InterviewerFeedback: fmt.Sprintf("I'm having trouble analyzing your code automatically. %s Let's focus on the core logic - can you walk me through your approach?", feedback),
		FollowUpQuestions: []string{
			"Can you explain your algorithm step by step?",
			"What's the time complexity of your solution?",
			"How would you handle edge cases?",
		},
		Complexity: ComplexityAnalysis{
			TimeComplexity:    "Unable to analyze",
			SpaceComplexity:   "Unable to analyze",
			CanOptimize:       false,
			OptimizedApproach: "Rerun analysis after fixing any syntax issues",
		},
		ReadabilityScore: 50,
		TestCoverage:     "Unable to assess due to parsing error",
	}
}

// parseQuestions parses questions from AI response
func (ai *AIService) parseQuestions(response string) []string {
	// Try to extract JSON array
	start := strings.Index(response, "[")
	end := strings.LastIndex(response, "]")

	if start == -1 || end == -1 {
		return []string{"What's the time complexity of your solution?", "How would you handle edge cases?", "Can you optimize this further?"}
	}

	jsonStr := response[start : end+1]

	var questions []string
	err := json.Unmarshal([]byte(jsonStr), &questions)
	if err != nil {
		return []string{"What's the time complexity of your solution?", "How would you handle edge cases?", "Can you optimize this further?"}
	}

	return questions
}

// parseHint extracts hint from AI response
func (ai *AIService) parseHint(response string) string {
	// Clean up the response
	hint := strings.TrimSpace(response)
	if hint == "" {
		return "Consider the problem step by step. What's the core requirement here?"
	}
	return hint
}

// buildChatPrompt creates the prompt for chat conversations
func (ai *AIService) buildChatPrompt(userMessage string, challenge *models.Challenge, conversationHistory []ChatMessage, codeContext string) string {
	challengeContext := ""
	if challenge != nil {
		challengeContext = fmt.Sprintf("Current Challenge: %s", challenge.Title)
	}

	codeContextStr := ""
	hasCode := false
	if codeContext != "" && strings.TrimSpace(codeContext) != "" {
		codeContextStr = fmt.Sprintf("\nUser's Current Code:\n```go\n%s\n```", codeContext)
		hasCode = true
	}

	historyStr := ""
	if len(conversationHistory) > 0 {
		historyStr = "\nConversation History:\n"
		// Only include last 5 messages to avoid token limits
		start := 0
		if len(conversationHistory) > 5 {
			start = len(conversationHistory) - 5
		}
		for _, msg := range conversationHistory[start:] {
			role := "User"
			if msg.Role == "assistant" {
				role = "Mentor"
			}
			historyStr += fmt.Sprintf("%s: %s\n", role, msg.Content)
		}
	}

	codeAwarenessInstructions := ""
	if hasCode {
		codeAwarenessInstructions = `
- I can see the user's current code above, so refer to it directly when relevant
- Point out specific parts of their code when giving feedback
- Suggest improvements to their existing code rather than asking them to paste it`
	} else {
		codeAwarenessInstructions = `
- The user hasn't written any code yet, or I can't see their current code
- If they ask about their code, let them know I can automatically see their code in the editor, but if they prefer, they can paste it here`
	}

	return fmt.Sprintf(`You are a friendly and knowledgeable Go programming mentor. You're helping a student learn Go through hands-on coding challenges.

CONTEXT:
%s%s%s

STUDENT'S QUESTION: %s

INSTRUCTIONS:
- Be encouraging and supportive
- Give clear, practical explanations with examples when helpful
- If discussing code, provide Go code snippets when relevant
- When showing code examples, use triple backticks with "go" directly after (not on separate line)
- Keep responses concise but thorough (aim for 2-3 paragraphs)
- If the student is struggling, break down concepts into smaller steps
- Relate answers back to the current challenge when possible
- Use emojis sparingly and appropriately
- If asked about non-Go/programming topics, gently redirect to programming%s

Respond naturally as a helpful mentor would in a conversation.`, challengeContext, codeContextStr, historyStr, userMessage, codeAwarenessInstructions)
}

// parseChatResponse cleans up and formats the chat response
func (ai *AIService) parseChatResponse(response string) string {
	// Clean up the response
	cleaned := strings.TrimSpace(response)

	// Remove any markdown code blocks markers if they appear at the start/end
	cleaned = strings.TrimPrefix(cleaned, "```")
	cleaned = strings.TrimSuffix(cleaned, "```")
	cleaned = strings.TrimSpace(cleaned)

	if cleaned == "" {
		return "I'm here to help! Could you rephrase your question?"
	}

	return cleaned
}

// generateFollowUpSuggestions creates contextual follow-up suggestions
func (ai *AIService) generateFollowUpSuggestions(userMessage, aiResponse string, challenge *models.Challenge) []string {
	suggestions := []string{}

	userLower := strings.ToLower(userMessage)

	// Context-aware suggestions based on user's question
	if strings.Contains(userLower, "explain") || strings.Contains(userLower, "what") {
		suggestions = append(suggestions, "Can you show me an example?")
		suggestions = append(suggestions, "How would I implement this?")
	}

	if strings.Contains(userLower, "error") || strings.Contains(userLower, "problem") {
		suggestions = append(suggestions, "How can I debug this?")
		suggestions = append(suggestions, "What's the best practice here?")
	}

	if strings.Contains(userLower, "optimize") || strings.Contains(userLower, "performance") {
		suggestions = append(suggestions, "What's the time complexity?")
		suggestions = append(suggestions, "Are there other approaches?")
	}

	// Default suggestions if no specific context
	if len(suggestions) == 0 {
		suggestions = []string{
			"Can you explain this more?",
			"Show me best practices",
			"Help with the current challenge",
		}
	}

	// Limit to 3 suggestions
	if len(suggestions) > 3 {
		suggestions = suggestions[:3]
	}

	return suggestions
}

// getCurrentTimestamp returns current time in ISO format
func getCurrentTimestamp() string {
	return time.Now().Format(time.RFC3339)
}

// getContextDescription provides a human-readable context description
func getContextDescription(challenge *models.Challenge) string {
	if challenge == nil {
		return "General Go programming discussion"
	}
	return fmt.Sprintf("Working on: %s", challenge.Title)
}
