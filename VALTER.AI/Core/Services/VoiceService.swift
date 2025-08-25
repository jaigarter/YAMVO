import Foundation

// MARK: - VoiceServiceProtocol
protocol VoiceServiceProtocol {
    func startListening()
    func stopListening()
    // In the future: a publisher/callback to deliver transcriptions
}

// MARK: - VoiceService
final class VoiceService: VoiceServiceProtocol {
    func startListening() {
        print("Comenzando a escuchar...")
    }
    
    func stopListening() {
        print("Deteniendo la escucha.")
    }
}

