import SwiftUI

/// One colour reaction of the sign-in header, drawn in the style picked in the prototype controls:
/// the classic soft circle, or one of the pixel sweeps. Used by the sign-in header and by the
/// preview in the Cart tab, so what you tune there is exactly what the app plays.
struct HeaderWash: View {
    let event: AuthFlow.HeaderEvent
    let size: CGSize
    var onCovered: () -> Void
    var onReceding: () -> Void
    var onFinished: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// Taken once, so changing the settings mid-reaction can't restart or swap it.
    @State private var settings: HeaderTransitionSettings

    init(event: AuthFlow.HeaderEvent, size: CGSize, settings: HeaderTransitionSettings,
         onCovered: @escaping () -> Void, onReceding: @escaping () -> Void, onFinished: @escaping () -> Void) {
        self.event = event
        self.size = size
        self.onCovered = onCovered
        self.onReceding = onReceding
        self.onFinished = onFinished
        _settings = State(initialValue: settings)
    }

    var body: some View {
        let style = settings.style(for: event.kind)
        // Reduce Motion keeps the gentle crossfade of the classic wash.
        if style.usesPixels && !reduceMotion {
            PixelWash(event: event, size: size, style: style, params: settings[style],
                      onCovered: onCovered, onReceding: onReceding, onFinished: onFinished)
        } else {
            CircleWash(event: event, size: size, onCovered: onCovered, onReceding: onReceding, onFinished: onFinished)
        }
    }
}

extension AuthFlow.HeaderEvent {
    /// Where the reaction starts; without a known cause, the upper middle of the header.
    func startPoint(in size: CGSize) -> CGPoint {
        origin == .zero ? CGPoint(x: size.width / 2, y: size.height * 0.3) : origin
    }
}

// MARK: - Classic

/// The classic reaction: a circle of the tone's gradient grows from the cause until it covers the
/// header, holds long enough to read, then fades back to what's underneath.
private struct CircleWash: View {
    let event: AuthFlow.HeaderEvent
    let size: CGSize
    var onCovered: () -> Void
    var onReceding: () -> Void
    var onFinished: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var grown = false
    @State private var visible = true

    private struct Timing {
        var grow: Double
        var hold: Double
        var fade: Double
    }

    private var timing: Timing {
        switch event.kind {
        case .success: Timing(grow: 0.55, hold: 1.0, fade: 0.6)
        case .error: Timing(grow: 0.4, hold: 0.7, fade: 0.5)
        case .welcome: Timing(grow: 0.55, hold: 1.9, fade: 0.6)
        }
    }

    private var radius: CGFloat {
        let origin = event.startPoint(in: size)
        let corners = [CGPoint.zero, CGPoint(x: size.width, y: 0), CGPoint(x: 0, y: size.height), CGPoint(x: size.width, y: size.height)]
        return corners.map { hypot($0.x - origin.x, $0.y - origin.y) }.max() ?? size.height
    }

    var body: some View {
        HeaderTone(event.kind).gradient
            .mask {
                Circle()
                    .frame(width: radius * 2, height: radius * 2)
                    .scaleEffect(grown || reduceMotion ? 1 : 0.02)
                    .position(event.startPoint(in: size))
            }
            .opacity(visible && (grown || !reduceMotion) ? 1 : 0)
            .allowsHitTesting(false)
            .task { await run() }
    }

    private func run() async {
        let grow: Animation = reduceMotion
            ? .easeOut(duration: 0.2)
            : .timingCurve(0.23, 1, 0.32, 1, duration: timing.grow)
        withAnimation(grow) { grown = true }
        try? await Task.sleep(for: .seconds(timing.grow * 0.45))
        guard !Task.isCancelled else { return }
        onCovered()
        try? await Task.sleep(for: .seconds(timing.grow * 0.55 + timing.hold))
        guard !Task.isCancelled else { return }
        onReceding()
        withAnimation(.easeInOut(duration: timing.fade)) { visible = false }
        try? await Task.sleep(for: .seconds(timing.fade))
        guard !Task.isCancelled else { return }
        onFinished()
    }
}

// MARK: - Pixels

/// A pixel reaction: the grid radiates out from the cause, the colour lands behind it and the grid
/// fades to solid; after the hold, the grid returns and the pixels sweep out the same way.
private struct PixelWash: View {
    let event: AuthFlow.HeaderEvent
    let size: CGSize
    let style: HeaderTransitionStyle
    let params: PixelWashParams
    var onCovered: () -> Void
    var onReceding: () -> Void
    var onFinished: () -> Void

    @State private var start = Date.now
    @State private var finished = false

    /// Error is a nudge, not news: it holds a little shorter.
    private var hold: Double { event.kind == .error ? params.hold * 0.75 : params.hold }
    private var lead: Double { PixelFrame.lead(for: params) }

    var body: some View {
        TimelineView(.animation(paused: finished)) { context in
            let fronts = fronts(at: context.date.timeIntervalSince(start))
            let cells = PixelFrame(
                style: style,
                params: params,
                origin: event.startPoint(in: size),
                frontIn: fronts.in,
                frontOut: fronts.out
            ).cells(in: size)
            // Paths compare by value, so every frame that changes a cell redraws.
            ZStack {
                cells.tone.fill(HeaderTone(event.kind).gradient)
                ForEach(cells.lights.indices, id: \.self) { level in
                    cells.lights[level].fill(Color.white.opacity(PixelFrame.opacity(ofLevel: level)))
                }
            }
            .frame(width: size.width, height: size.height)
        }
        .allowsHitTesting(false)
        .task { await run() }
    }

    /// Where each front is `elapsed` seconds in, in 0…1 of the header's reach. Both ease out, like an
    /// impulse spreading: quick off the cause, slowing as they reach the top where you're looking.
    private func fronts(at elapsed: Double) -> (in: Double, out: Double?) {
        let span = 1 + params.band + lead
        let inProgress = min(max(elapsed / params.spread, 0), 1)
        let frontIn = -lead + (1 - pow(1 - inProgress, 1.7)) * span

        let outElapsed = elapsed - params.spread - hold
        guard outElapsed > 0 else { return (frontIn, nil) }
        let outProgress = min(outElapsed / params.recede, 1)
        return (frontIn, -lead + (1 - pow(1 - outProgress, 1.7)) * span)
    }

    private func run() async {
        start = .now
        try? await Task.sleep(for: .seconds(params.spread * 0.45))
        guard !Task.isCancelled else { return }
        onCovered()
        try? await Task.sleep(for: .seconds(params.spread * 0.55 + hold))
        guard !Task.isCancelled else { return }
        onReceding()
        try? await Task.sleep(for: .seconds(params.recede))
        guard !Task.isCancelled else { return }
        finished = true
        onFinished()
    }
}

/// One frame of a pixel reaction. Each cell works out when the front reaches it and becomes
/// nothing, a faint light (grid ahead of the front), a partly grown pixel of the tone, or solid
/// tone. Tone cells share one path, filled with the header gradient; flashes of light are bucketed
/// into a few white paths on top, so a frame is a handful of fills however many cells there are.
private struct PixelFrame {
    let style: HeaderTransitionStyle
    let params: PixelWashParams
    let origin: CGPoint
    let frontIn: Double
    /// Nil until the out sweep starts.
    let frontOut: Double?

    static let lightLevels = 8

    static func lead(for params: PixelWashParams) -> Double { max(params.band * 0.5, 0.02) }

    static func opacity(ofLevel level: Int) -> Double { (Double(level) + 0.5) / Double(lightLevels) }

    private enum Shape { case square, dot }

    func cells(in size: CGSize) -> (tone: Path, lights: [Path]) {
        var toneCells = Path()
        var lights = [Path](repeating: Path(), count: Self.lightLevels)

        let cell = max(params.cell, 2)
        let columns = Int((size.width / cell).rounded(.up))
        let rows = Int((size.height / cell).rounded(.up))
        guard columns > 0, rows > 0 else { return (toneCells, lights) }

        let corners = [CGPoint.zero, CGPoint(x: size.width, y: 0), CGPoint(x: 0, y: size.height), CGPoint(x: size.width, y: size.height)]
        let diamond = style == .bloom
        let reach = max(corners.map { diamond ? abs($0.x - origin.x) + abs($0.y - origin.y) : hypot($0.x - origin.x, $0.y - origin.y) }.max() ?? 1, 1)

        let band = max(params.band, 0.01)
        let lead = Self.lead(for: params)
        let receding = frontOut != nil
        let front = frontOut ?? frontIn
        let half = cell / 2
        let gap = params.gap
        let glow = params.glow
        let lingerPower = mix(3, 0.45, params.grid)
        let fullRadius = half * 1.415 + 0.5
        let dotRadius = max(half - gap / 2, 1) * 0.35

        func add(_ shape: Shape, _ extent: Double, center: CGPoint, to path: inout Path) {
            guard extent > 0.15 else { return }
            switch shape {
            case .square:
                if extent >= half {
                    path.addRect(CGRect(x: center.x - half, y: center.y - half, width: cell, height: cell))
                } else {
                    path.addRect(CGRect(x: center.x - extent, y: center.y - extent, width: extent * 2, height: extent * 2))
                }
            case .dot:
                if extent >= fullRadius - 0.01 {
                    path.addRect(CGRect(x: center.x - half, y: center.y - half, width: cell, height: cell))
                } else {
                    path.addEllipse(in: CGRect(x: center.x - extent, y: center.y - extent, width: extent * 2, height: extent * 2))
                }
            }
        }

        func light(_ amount: Double, _ shape: Shape, _ extent: Double, center: CGPoint) {
            guard amount > 0.03 else { return }
            let level = min(Self.lightLevels - 1, Int(amount * Double(Self.lightLevels)))
            add(shape, extent, center: center, to: &lights[level])
        }

        for row in 0..<rows {
            for column in 0..<columns {
                let center = CGPoint(x: (Double(column) + 0.5) * cell, y: (Double(row) + 0.5) * cell)
                let dx = center.x - origin.x
                let dy = center.y - origin.y
                let distance = (diamond ? abs(dx) + abs(dy) : hypot(dx, dy)) / reach
                let h1 = Self.hash(column, row)
                let h2 = Self.hash(column &+ 17, row &+ 31)
                // Scatter trades the clean ring for a per-cell order.
                let d = mix(distance, h1, params.scatter)

                // 0 → 1 as the front approaches the cell, then 0 → 1 across the band behind it.
                let approach = clamp((front + lead - d) / lead)
                let t = clamp((front - d) / band)
                let reached = front > d

                if !receding && approach <= 0 { continue }
                if receding && approach <= 0 {
                    add(.square, half, center: center, to: &toneCells)
                    continue
                }

                switch style {
                case .smooth, .ripple:
                    if !receding {
                        if !reached {
                            // The grid radiates first: faint lit squares over the blue, ahead of the front.
                            light(glow * 0.45 * approach * approach, .square, half - max(gap, 1) / 2, center: center)
                            continue
                        }
                        let linger = pow(1 - t, lingerPower)
                        let pop = smoothstep(0, 0.3, t)
                        let extent = mix((half - gap * linger / 2) * mix(0.55, 1, pop), half, 1 - linger)
                        add(.square, extent, center: center, to: &toneCells)
                        light(glow * pow(1 - t, 2), .square, extent, center: center)
                    } else {
                        // The grid comes back over the colour, then each pixel shrinks away.
                        let extent = mix(half, half - gap / 2, approach) * (1 - smoothstep(0, 1, t))
                        add(.square, extent, center: center, to: &toneCells)
                        light(glow * 0.6 * approach * (1 - t), .square, extent, center: center)
                    }

                case .dissolve:
                    if !receding {
                        if !reached {
                            // A few cells sparkle ahead of the front.
                            if h2 > 0.55 { light(glow * 0.5 * approach * approach, .square, half - max(gap, 1) / 2, center: center) }
                            continue
                        }
                        let linger = pow(1 - t, lingerPower)
                        let extent = mix(half - gap / 2, half, 1 - linger)
                        add(.square, extent, center: center, to: &toneCells)
                        light(glow * (1 - smoothstep(0, 0.55, t)) * (0.45 + 0.55 * h2), .square, extent, center: center)
                    } else {
                        // Each cell brightens, then blinks off at its own moment.
                        let off = 0.15 + 0.7 * h2
                        guard t <= off else { continue }
                        let extent = mix(half, half - gap / 2, approach)
                        add(.square, extent, center: center, to: &toneCells)
                        light(glow * approach * smoothstep(0, 1, t / off), .square, extent, center: center)
                    }

                case .bloom:
                    if !receding {
                        if !reached {
                            // Tiny light dots mark the grid just ahead of the front.
                            light(glow * 0.6 * approach, .dot, dotRadius * approach, center: center)
                            continue
                        }
                        let grow = mix(smoothstep(0, 1, t), pow(t, 1.6), params.grid)
                        let radius = mix(dotRadius, fullRadius, grow)
                        add(.dot, radius, center: center, to: &toneCells)
                        light(glow * (1 - t), .dot, radius, center: center)
                    } else {
                        let radius = fullRadius * (1 - smoothstep(0, 1, t))
                        add(.dot, radius, center: center, to: &toneCells)
                        light(glow * 0.5 * approach * (1 - t), .dot, radius, center: center)
                    }
                }
            }
        }

        return (toneCells, lights)
    }

    // MARK: Math

    /// A stable 0…1 value per cell, so the scatter doesn't shimmer between frames.
    private static func hash(_ x: Int, _ y: Int) -> Double {
        var h = UInt32(truncatingIfNeeded: x &* 374_761_393 &+ y &* 668_265_263)
        h = (h ^ (h >> 13)) &* 1_274_126_177
        h ^= h >> 16
        return Double(h) / Double(UInt32.max)
    }
}

private func clamp(_ x: Double) -> Double { min(max(x, 0), 1) }

private func mix(_ a: Double, _ b: Double, _ t: Double) -> Double { a + (b - a) * t }

private func smoothstep(_ edge0: Double, _ edge1: Double, _ x: Double) -> Double {
    let t = clamp((x - edge0) / (edge1 - edge0))
    return t * t * (3 - 2 * t)
}
