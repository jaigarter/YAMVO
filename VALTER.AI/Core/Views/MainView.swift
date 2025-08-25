import SwiftUI

// MARK: - MainView
struct MainView: View {
    @StateObject private var viewModel = MainViewModel()
    @FocusState private var isTextFieldFocused: Bool
    
    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            
            VStack(spacing: 16) {
                Spacer().frame(height: 8)
                
                // Sphere
                SphereView(state: viewModel.sphereState)
                    .padding(.top, 16)
                
                // Chat messages
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        ForEach(viewModel.messages) { message in
                            messageRow(for: message)
                        }
                    }
                    .padding(.horizontal, 16)
                }
                
                // Input area
                inputBar
                    .padding(12)
                    .background(Color.white.opacity(0.04))
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    .padding([.horizontal, .bottom], 16)
            }
        }
        .preferredColorScheme(.dark)
    }
    
    private var inputBar: some View {
        HStack(spacing: 10) {
            Button {
                viewModel.toggleListening()
            } label: {
                Image(systemName: viewModel.isListening ? "mic.fill" : "mic")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(viewModel.isListening ? .red : .white)
                    .frame(width: 36, height: 36)
                    .background(Color.white.opacity(0.06))
                    .clipShape(Circle())
            }
            
            TextField("Escribe un mensaje...", text: $viewModel.inputText, axis: .vertical)
                .textFieldStyle(.plain)
                .foregroundColor(.white)
                .padding(10)
                .background(Color.white.opacity(0.06))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .focused($isTextFieldFocused)
                .submitLabel(.send)
                .onSubmit(send)
            
            Button(action: send) {
                Image(systemName: "paperplane.fill")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(width: 36, height: 36)
                    .background(Color.accentColor.opacity(0.9))
                    .clipShape(Circle())
            }
            .disabled(viewModel.inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            .opacity(viewModel.inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.5 : 1)
        }
    }
    
    private func messageRow(for message: ChatMessage) -> some View {
        HStack(alignment: .top, spacing: 10) {
            if message.sender == .valter { avatar(for: .valter) }
            
            Text(message.text)
                .foregroundColor(.white)
                .padding(12)
                .background(message.sender == .user ? Color.blue.opacity(0.4) : Color.white.opacity(0.06))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .frame(maxWidth: .infinity, alignment: message.sender == .user ? .trailing : .leading)
            
            if message.sender == .user { avatar(for: .user) }
        }
    }
    
    private func avatar(for sender: ChatMessage.Sender) -> some View {
        Group {
            switch sender {
            case .user:
                Image(systemName: "person.fill")
            case .valter:
                Image(systemName: "sparkles")
            }
        }
        .font(.system(size: 14, weight: .bold))
        .foregroundColor(.white)
        .frame(width: 28, height: 28)
        .background(Color.white.opacity(0.08))
        .clipShape(Circle())
    }
    
    private func send() {
        let text = viewModel.inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        viewModel.sendMessage(text: text)
        viewModel.inputText = ""
        isTextFieldFocused = false
    }
}

struct MainView_Previews: PreviewProvider {
    static var previews: some View {
        MainView()
    }
}

