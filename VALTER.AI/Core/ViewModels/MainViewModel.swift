import Foundation
import Combine

// MARK: - MainViewModel
final class MainViewModel: ObservableObject {
    // UI State
    @Published var messages: [ChatMessage] = []
    @Published var tasks: [TaskItem] = []
    @Published var sphereState: SphereState = .idle
    @Published var inputText: String = ""
    @Published var isListening: Bool = false
    
    // Services
    private let aiService: AIServiceProtocol
    private let voiceService: VoiceServiceProtocol
    private var cancellables = Set<AnyCancellable>()
    
    init(aiService: AIServiceProtocol = AIService(), voiceService: VoiceServiceProtocol = VoiceService()) {
        self.aiService = aiService
        self.voiceService = voiceService
        seedInitialContent()
    }
    
    // MARK: - User Intents
    @MainActor
    func sendMessage(text: String) {
        let userMessage = ChatMessage(text: text, sender: .user)
        messages.append(userMessage)
        sphereState = .thinking
        Task { await respond(to: text) }
    }
    
    func toggleTask(task: TaskItem) {
        guard let index = tasks.firstIndex(where: { $0.id == task.id }) else { return }
        tasks[index].isCompleted.toggle()
    }
    
    func toggleListening() {
        isListening.toggle()
        sphereState = isListening ? .listening : .idle
        if isListening { voiceService.startListening() } else { voiceService.stopListening() }
    }
    
    // MARK: - Private
    @MainActor
    private func respond(to text: String) async {
        let replyText = await aiService.getResponse(for: text)
        let reply = ChatMessage(text: replyText, sender: .valter)
        messages.append(reply)
        sphereState = .speaking
        // Simulate speaking duration
        try? await Task.sleep(nanoseconds: 900_000_000)
        sphereState = .idle
    }
    
    private func seedInitialContent() {
        // Example tasks
        tasks = [
            TaskItem(title: "Respirar profundo 3 veces"),
            TaskItem(title: "Revisar objetivos del día"),
            TaskItem(title: "Caminar 10 minutos")
        ]
        
        // Welcome message
        messages = [
            ChatMessage(text: "Hola, soy VALTER. ¿En qué te ayudo hoy?", sender: .valter)
        ]
    }
    
    // MARK: - Stubs for future integrations
    func scheduleMotivationalAlarm(at date: Date) {
        // TODO: Integrate with UNUserNotificationCenter for alarms
    }
    
    func handleVoiceTranscription(_ text: String) {
        // TODO: Receive transcriptions from VoiceService and forward to sendMessage
    }
}

