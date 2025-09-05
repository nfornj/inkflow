/**
 * LLM Autofill Field Component
 * Phase 6 Implementation
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import useLLMAutofill from "../hooks/useLLMAutofill";
import {
  FieldContext,
  AutofillSuggestionResult,
  AutofillQuestionResult,
} from "../types/electron";

interface LLMAutofillFieldProps {
  fieldType: string;
  fieldName?: string;
  fieldImportance?: "low" | "medium" | "high";
  required?: boolean;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  onSuggestion?: (suggestion: string) => void;
  onQuestion?: (question: string) => void;
  onValidation?: (isValid: boolean, feedback?: string) => void;
  onError?: (error: string) => void;
  children?: React.ReactNode;
}

const LLMAutofillField: React.FC<LLMAutofillFieldProps> = ({
  fieldType,
  fieldName,
  fieldImportance = "medium",
  required = false,
  placeholder,
  className = "",
  style,
  onSuggestion,
  onQuestion,
  onValidation,
  onError,
  children,
}) => {
  // State
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [showQuestion, setShowQuestion] = useState(false);
  const [suggestionText, setSuggestionText] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLDivElement>(null);

  // LLM Autofill hook
  const {
    getSuggestion,
    generateQuestion,
    validateInput,
    processInput,
    setCursorState,
    setFocus,
    isProcessing,
    lastSuggestion,
    lastQuestion,
    error,
  } = useLLMAutofill({
    onSuggestion: (result: AutofillSuggestionResult) => {
      if (result.success && result.suggestion) {
        setSuggestionText(result.suggestion);
        setShowSuggestion(true);
        onSuggestion?.(result.suggestion);
      }
    },
    onQuestion: (result: AutofillQuestionResult) => {
      if (result.success && result.question) {
        setQuestionText(result.question);
        setShowQuestion(true);
        onQuestion?.(result.question);
      }
    },
    onError: (error: string) => {
      onError?.(error);
    },
  });

  // Field context
  const fieldContext: FieldContext = {
    field_type: fieldType,
    field_name: fieldName,
    field_importance: fieldImportance,
    required,
  };

  // Handle focus
  const handleFocus = useCallback(async () => {
    setIsFocused(true);

    if (inputRef.current) {
      setCursorState(inputRef.current, "wait");
    }

    // Get suggestion if field is empty
    if (!value.trim()) {
      try {
        await getSuggestion(fieldContext);
      } catch (err) {
        console.error("Error getting suggestion:", err);
      }
    }

    if (inputRef.current) {
      setCursorState(inputRef.current, "text");
    }
  }, [value, fieldContext, getSuggestion, setCursorState]);

  // Handle blur
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    setShowSuggestion(false);
    setShowQuestion(false);
  }, []);

  // Handle input change
  const handleInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setValue(newValue);

      // Validate input if it's not empty
      if (newValue.trim()) {
        setIsValidating(true);
        try {
          const validationResult = await validateInput(newValue, fieldType);
          if (validationResult.success) {
            onValidation?.(
              validationResult.valid || false,
              validationResult.feedback
            );
          }
        } catch (err) {
          console.error("Error validating input:", err);
        } finally {
          setIsValidating(false);
        }
      }
    },
    [fieldType, validateInput, onValidation]
  );

  // Handle suggestion click
  const handleSuggestionClick = useCallback(() => {
    if (suggestionText && inputRef.current) {
      setValue(suggestionText);
      setShowSuggestion(false);
      setFocus(inputRef.current);
      onSuggestion?.(suggestionText);
    }
  }, [suggestionText, setFocus, onSuggestion]);

  // Handle question click
  const handleQuestionClick = useCallback(() => {
    if (questionText) {
      // Show OS-level input prompt
      const userInput = prompt(questionText);
      if (userInput && inputRef.current) {
        setValue(userInput);
        setFocus(inputRef.current);
        onQuestion?.(userInput);
      }
      setShowQuestion(false);
    }
  }, [questionText, setFocus, onQuestion]);

  // Handle key down
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && showSuggestion && suggestionText) {
        e.preventDefault();
        handleSuggestionClick();
      } else if (e.key === "Escape") {
        setShowSuggestion(false);
        setShowQuestion(false);
      }
    },
    [showSuggestion, suggestionText, handleSuggestionClick]
  );

  // Process input when user types
  const handleInputComplete = useCallback(async () => {
    if (value.trim()) {
      try {
        await processInput(value, fieldType);
      } catch (err) {
        console.error("Error processing input:", err);
      }
    }
  }, [value, fieldType, processInput]);

  // Auto-process input after delay
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (value.trim()) {
        handleInputComplete();
      }
    }, 1000); // 1 second delay

    return () => clearTimeout(timeout);
  }, [value, handleInputComplete]);

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionRef.current &&
        !suggestionRef.current.contains(event.target as Node) &&
        questionRef.current &&
        !questionRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestion(false);
        setShowQuestion(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`llm-autofill-field ${className}`} style={style}>
      {/* Input field */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || `Enter ${fieldName || fieldType}...`}
        className={`llm-autofill-input ${isProcessing ? "processing" : ""} ${
          isValidating ? "validating" : ""
        }`}
        style={{
          width: "100%",
          padding: "8px 12px",
          border: "1px solid #ccc",
          borderRadius: "4px",
          fontSize: "14px",
          outline: "none",
          transition: "all 0.2s ease",
          ...(isFocused && {
            borderColor: "#007bff",
            boxShadow: "0 0 0 2px rgba(0, 123, 255, 0.25)",
          }),
          ...(isProcessing && { opacity: 0.7, cursor: "wait" }),
          ...(isValidating && { borderColor: "#ffc107" }),
        }}
      />

      {/* Suggestion popup */}
      {showSuggestion && suggestionText && (
        <div
          ref={suggestionRef}
          className="llm-autofill-suggestion"
          onClick={handleSuggestionClick}
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            backgroundColor: "#f8f9fa",
            border: "1px solid #dee2e6",
            borderRadius: "4px",
            padding: "8px 12px",
            marginTop: "2px",
            cursor: "pointer",
            fontSize: "14px",
            zIndex: 1000,
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ color: "#6c757d", fontSize: "12px" }}>💡</span>
            <span>{suggestionText}</span>
            <span
              style={{ color: "#6c757d", fontSize: "12px", marginLeft: "auto" }}
            >
              Press Enter to use
            </span>
          </div>
        </div>
      )}

      {/* Question popup */}
      {showQuestion && questionText && (
        <div
          ref={questionRef}
          className="llm-autofill-question"
          onClick={handleQuestionClick}
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            backgroundColor: "#e3f2fd",
            border: "1px solid #2196f3",
            borderRadius: "4px",
            padding: "8px 12px",
            marginTop: "2px",
            cursor: "pointer",
            fontSize: "14px",
            zIndex: 1000,
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ color: "#1976d2", fontSize: "12px" }}>❓</span>
            <span>{questionText}</span>
            <span
              style={{ color: "#1976d2", fontSize: "12px", marginLeft: "auto" }}
            >
              Click to answer
            </span>
          </div>
        </div>
      )}

      {/* Processing indicator */}
      {isProcessing && (
        <div
          className="llm-autofill-processing"
          style={{
            position: "absolute",
            top: "50%",
            right: "12px",
            transform: "translateY(-50%)",
            color: "#6c757d",
            fontSize: "12px",
          }}
        >
          <span style={{ animation: "pulse 1s infinite" }}>⏳</span>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div
          className="llm-autofill-error"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            backgroundColor: "#f8d7da",
            border: "1px solid #f5c6cb",
            borderRadius: "4px",
            padding: "8px 12px",
            marginTop: "2px",
            color: "#721c24",
            fontSize: "12px",
            zIndex: 1000,
          }}
        >
          {error}
        </div>
      )}

      {/* Custom children */}
      {children}
    </div>
  );
};

export default LLMAutofillField;

