import Foundation

// MARK: - AIServiceProtocol
protocol AIServiceProtocol {
    func getResponse(for text: String) async -> String
}

// MARK: - AIService
final class AIService: AIServiceProtocol {
    func getResponse(for text: String) async -> String {
        // Simulación de latencia de red
        try? await Task.sleep(nanoseconds: 1_500_000_000)
        return "Esta es una respuesta simulada para: '\(text)'."
    }
}

