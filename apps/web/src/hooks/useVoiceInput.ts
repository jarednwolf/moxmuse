'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

interface VoiceInputOptions {
  onResult: (transcript: string, confidence: number) => void
  onError?: (error: string) => void
  onStart?: () => void
  onEnd?: () => void
  continuous?: boolean
  interimResults?: boolean
  language?: string
  maxAlternatives?: number
}

interface VoiceInputState {
  isListening: boolean
  isSupported: boolean
  transcript: string
  confidence: number
  error: string | null
  interimTranscript: string
}

export function useVoiceInput({
  onResult,
  onError,
  onStart,
  onEnd,
  continuous = false,
  interimResults = true,
  language = 'en-US',
  maxAlternatives = 1
}: VoiceInputOptions) {
  const [state, setState] = useState<VoiceInputState>({
    isListening: false,
    isSupported: typeof window !== 'undefined' && 'webkitSpeechRecognition' in window,
    transcript: '',
    confidence: 0,
    error: null,
    interimTranscript: ''
  })

  const recognitionRef = useRef<any>(null)
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check for speech recognition support
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    
    if (!SpeechRecognition) {
      setState(prev => ({ ...prev, isSupported: false }))
      return
    }

    // Initialize speech recognition
    const recognition = new SpeechRecognition()
    recognition.continuous = continuous
    recognition.interimResults = interimResults
    recognition.lang = language
    recognition.maxAlternatives = maxAlternatives

    recognition.onstart = () => {
      setState(prev => ({ ...prev, isListening: true, error: null }))
      onStart?.()
    }

    recognition.onresult = (event: any) => {
      let finalTranscript = ''
      let interimTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript

        if (result.isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }

      if (finalTranscript) {
        const confidence = event.results[event.results.length - 1][0].confidence || 0
        setState(prev => ({
          ...prev,
          transcript: finalTranscript,
          confidence,
          interimTranscript: ''
        }))
        onResult(finalTranscript, confidence)
      } else {
        setState(prev => ({ ...prev, interimTranscript }))
      }
    }

    recognition.onerror = (event: any) => {
      const errorMessage = getErrorMessage(event.error)
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isListening: false,
        interimTranscript: ''
      }))
      onError?.(errorMessage)
    }

    recognition.onend = () => {
      setState(prev => ({
        ...prev,
        isListening: false,
        interimTranscript: ''
      }))
      onEnd?.()
    }

    recognitionRef.current = recognition

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [continuous, interimResults, language, maxAlternatives, onResult, onError, onStart, onEnd])

  const startListening = useCallback(() => {
    if (!state.isSupported || !recognitionRef.current) {
      onError?.('Speech recognition is not supported in this browser')
      return
    }

    if (state.isListening) {
      return
    }

    try {
      recognitionRef.current.start()
      
      // Auto-stop after 10 seconds if not continuous
      if (!continuous) {
        timeoutRef.current = setTimeout(() => {
          stopListening()
        }, 10000)
      }
    } catch (error) {
      onError?.('Failed to start speech recognition')
    }
  }, [state.isSupported, state.isListening, continuous, onError])

  const stopListening = useCallback(() => {
    if (recognitionRef.current && state.isListening) {
      recognitionRef.current.stop()
    }
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }, [state.isListening])

  const toggleListening = useCallback(() => {
    if (state.isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [state.isListening, startListening, stopListening])

  return {
    ...state,
    startListening,
    stopListening,
    toggleListening
  }
}

function getErrorMessage(error: string): string {
  switch (error) {
    case 'no-speech':
      return 'No speech was detected. Please try again.'
    case 'audio-capture':
      return 'Audio capture failed. Please check your microphone.'
    case 'not-allowed':
      return 'Microphone access was denied. Please allow microphone access and try again.'
    case 'network':
      return 'Network error occurred. Please check your connection.'
    case 'service-not-allowed':
      return 'Speech recognition service is not allowed.'
    case 'bad-grammar':
      return 'Grammar error in speech recognition.'
    case 'language-not-supported':
      return 'Language is not supported.'
    default:
      return `Speech recognition error: ${error}`
  }
}

// Hook for voice commands
interface VoiceCommand {
  command: string | RegExp
  action: (matches?: string[]) => void
  description: string
}

interface VoiceCommandsOptions {
  commands: VoiceCommand[]
  continuous?: boolean
  language?: string
  confidenceThreshold?: number
}

export function useVoiceCommands({
  commands,
  continuous = true,
  language = 'en-US',
  confidenceThreshold = 0.7
}: VoiceCommandsOptions) {
  const [isActive, setIsActive] = useState(false)
  const [lastCommand, setLastCommand] = useState<string>('')

  const processCommand = useCallback((transcript: string, confidence: number) => {
    if (confidence < confidenceThreshold) {
      return
    }

    const normalizedTranscript = transcript.toLowerCase().trim()
    setLastCommand(normalizedTranscript)

    for (const command of commands) {
      if (typeof command.command === 'string') {
        if (normalizedTranscript.includes(command.command.toLowerCase())) {
          command.action()
          return
        }
      } else {
        const matches = normalizedTranscript.match(command.command)
        if (matches) {
          command.action(matches)
          return
        }
      }
    }
  }, [commands, confidenceThreshold])

  const voiceInput = useVoiceInput({
    onResult: processCommand,
    continuous,
    language,
    onStart: () => setIsActive(true),
    onEnd: () => setIsActive(false)
  })

  return {
    ...voiceInput,
    isActive,
    lastCommand,
    availableCommands: commands.map(cmd => ({
      command: typeof cmd.command === 'string' ? cmd.command : cmd.command.source,
      description: cmd.description
    }))
  }
}