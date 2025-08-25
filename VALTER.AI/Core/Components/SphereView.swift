import SwiftUI

// MARK: - SphereState
enum SphereState {
    case idle
    case listening
    case thinking
    case speaking
}

// MARK: - SphereView
struct SphereView: View {
    @State private var phase: CGFloat = 0.0
    var state: SphereState = .idle
    
    var body: some View {
        TimelineView(.animation) { timeline in
            Canvas { context, size in
                let center = CGPoint(x: size.width / 2, y: size.height / 2)
                let radius = min(size.width, size.height) / 2

                let time = timeline.date.timeIntervalSinceReferenceDate
                let speed = animationSpeed(for: state)
                let localPhase = CGFloat(time * speed).truncatingRemainder(dividingBy: .pi * 2)

                let colorSet = colors(for: state)
                let gradient = Gradient(colors: colorSet)

                let startRadius = radius * (0.6 + 0.1 * sin(localPhase))
                context.fill(
                    Path(ellipseIn: CGRect(origin: .zero, size: size)),
                    with: .radialGradient(
                        .init(gradient: gradient, center: .center, startRadius: startRadius, endRadius: radius)
                    )
                )

                // Subtle glow
                let glowAlpha: CGFloat = 0.25 + 0.15 * (sin(localPhase) + 1) / 2
                let glowColor = Color.white.opacity(glowAlpha)
                let glowPath = Path(ellipseIn: CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2))
                context.stroke(glowPath, with: .color(glowColor), lineWidth: 2)
            }
        }
        .frame(width: 220, height: 220)
        .shadow(color: .white.opacity(0.1), radius: 20, x: 0, y: 10)
        .accessibilityLabel("Esfera animada de VALTER.AI")
    }
    
    private func animationSpeed(for state: SphereState) -> Double {
        switch state {
        case .idle: return 0.5
        case .listening: return 1.0
        case .thinking: return 0.7
        case .speaking: return 1.2
        }
    }
    
    private func colors(for state: SphereState) -> [Color] {
        switch state {
        case .idle: return [.blue, .purple, .cyan]
        case .listening: return [.cyan, .mint, .blue]
        case .thinking: return [.purple, .indigo, .blue]
        case .speaking: return [.pink, .purple, .blue]
        }
    }
}

struct SphereView_Previews: PreviewProvider {
    static var previews: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            VStack(spacing: 24) {
                SphereView(state: .idle)
                SphereView(state: .listening)
                SphereView(state: .speaking)
            }
        }
        .preferredColorScheme(.dark)
    }
}

