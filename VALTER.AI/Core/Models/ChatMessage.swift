import Foundation

// MARK: - ChatMessage
struct ChatMessage: Identifiable, Codable {
    let id: UUID
    let text: String
    let sender: Sender
    let createdAt: Date
    
    init(id: UUID = UUID(), text: String, sender: Sender, createdAt: Date = Date()) {
        self.id = id
        self.text = text
        self.sender = sender
        self.createdAt = createdAt
    }
    
    enum Sender: String, Codable {
        case user
        case valter
    }
}

