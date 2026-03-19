import { act, renderHook } from '@testing-library/react-native'
import { Platform } from 'react-native'

// Mock expo-speech-recognition
const mockStart = jest.fn()
const mockStop = jest.fn()
const mockAbort = jest.fn()
const mockIsRecognitionAvailable = jest.fn()
const mockSupportsOnDeviceRecognition = jest.fn()
const mockRequestPermissionsAsync = jest.fn()

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    start: (...args: unknown[]) => mockStart(...args),
    stop: (...args: unknown[]) => mockStop(...args),
    abort: (...args: unknown[]) => mockAbort(...args),
    isRecognitionAvailable: () => mockIsRecognitionAvailable(),
    supportsOnDeviceRecognition: () => mockSupportsOnDeviceRecognition(),
    requestPermissionsAsync: () => mockRequestPermissionsAsync()
  },
  useSpeechRecognitionEvent: jest.fn()
}))

jest.mock('@/i18n', () => ({
  __esModule: true,
  default: { language: 'en-US' }
}))

import { useSpeechRecognition } from '../useSpeechRecognition'

describe('useSpeechRecognition', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequestPermissionsAsync.mockResolvedValue({ granted: true })
  })

  it('initializes with idle status', () => {
    const { result } = renderHook(() => useSpeechRecognition())
    expect(result.current.status).toBe('idle')
    expect(result.current.isListening).toBe(false)
    expect(result.current.isProcessing).toBe(false)
  })

  it('starts recognition when available', async () => {
    mockIsRecognitionAvailable.mockResolvedValue(true)

    const { result } = renderHook(() => useSpeechRecognition())

    await act(async () => {
      const success = await result.current.startListening()
      expect(success).toBe(true)
    })

    expect(mockStart).toHaveBeenCalledWith(
      expect.objectContaining({
        lang: 'en-US',
        interimResults: true,
        continuous: true
      })
    )
    // Should NOT use on-device recognition when default is available
    const startArgs = mockStart.mock.calls[0][0]
    expect(startArgs).not.toHaveProperty('requiresOnDeviceRecognition')
  })

  it('shows error when recognition is not available and on-device is not supported', async () => {
    mockIsRecognitionAvailable.mockResolvedValue(false)
    mockSupportsOnDeviceRecognition.mockReturnValue(false)

    const onError = jest.fn()
    const { result } = renderHook(() => useSpeechRecognition({ onError }))

    await act(async () => {
      const success = await result.current.startListening()
      expect(success).toBe(false)
    })

    expect(onError).toHaveBeenCalledWith('Speech recognition is not available on this device')
    expect(mockStart).not.toHaveBeenCalled()
  })

  it('falls back to on-device recognition on Android 13+ when default is unavailable', async () => {
    const originalOS = Platform.OS
    const originalVersion = Platform.Version

    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true })
    Object.defineProperty(Platform, 'Version', { value: 33, configurable: true })

    mockIsRecognitionAvailable.mockResolvedValue(false)
    mockSupportsOnDeviceRecognition.mockReturnValue(true)

    const { result } = renderHook(() => useSpeechRecognition())

    await act(async () => {
      const success = await result.current.startListening()
      expect(success).toBe(true)
    })

    expect(mockStart).toHaveBeenCalledWith(
      expect.objectContaining({
        requiresOnDeviceRecognition: true
      })
    )

    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true })
    Object.defineProperty(Platform, 'Version', { value: originalVersion, configurable: true })
  })

  it('falls back to on-device recognition on Android 16 (API 35) when default is unavailable', async () => {
    const originalOS = Platform.OS
    const originalVersion = Platform.Version

    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true })
    Object.defineProperty(Platform, 'Version', { value: 35, configurable: true })

    mockIsRecognitionAvailable.mockResolvedValue(false)
    mockSupportsOnDeviceRecognition.mockReturnValue(true)

    const { result } = renderHook(() => useSpeechRecognition())

    await act(async () => {
      const success = await result.current.startListening()
      expect(success).toBe(true)
    })

    expect(mockStart).toHaveBeenCalledWith(
      expect.objectContaining({
        requiresOnDeviceRecognition: true
      })
    )

    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true })
    Object.defineProperty(Platform, 'Version', { value: originalVersion, configurable: true })
  })

  it('does not use on-device fallback on iOS', async () => {
    const originalOS = Platform.OS

    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true })

    mockIsRecognitionAvailable.mockResolvedValue(false)
    mockSupportsOnDeviceRecognition.mockReturnValue(false)

    const onError = jest.fn()
    const { result } = renderHook(() => useSpeechRecognition({ onError }))

    await act(async () => {
      const success = await result.current.startListening()
      expect(success).toBe(false)
    })

    expect(onError).toHaveBeenCalledWith('Speech recognition is not available on this device')
    expect(mockStart).not.toHaveBeenCalled()

    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true })
  })

  it('returns error when permission is denied', async () => {
    mockIsRecognitionAvailable.mockResolvedValue(true)
    mockRequestPermissionsAsync.mockResolvedValue({ granted: false })

    const onError = jest.fn()
    const { result } = renderHook(() => useSpeechRecognition({ onError }))

    await act(async () => {
      const success = await result.current.startListening()
      expect(success).toBe(false)
    })

    expect(onError).toHaveBeenCalledWith('Speech recognition permission denied')
    expect(mockStart).not.toHaveBeenCalled()
  })
})
