import SwiftUI

/// The carousel above "Welcome to noon" and "Choose your account" in the separate Log in / Sign up
/// flow (Figma 1120:181329): artwork, a headline, a line under it and page dots. The first slide is
/// the designed "Get everything in minute"; the others are placeholders until their designs land.
/// Laid out in the Figma frame's coordinates (375 wide, measured from the top of the screen, with
/// unscaled type): the backdrop scales the whole thing with the design.
struct WelcomeCarousel: View {
    let visible: Bool

    @Environment(\.lang) private var lang
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var page = 0
    @State private var direction: CGFloat = 1
    @GestureState private var dragging = false

    static let size = CGSize(width: 375, height: 362)
    /// What's drawn inside the frame — the slide, then 12 to the 5pt dots — so the backdrop can
    /// centre it in the blue rather than centre the frame.
    static let contentTop: CGFloat = 116.98
    static let contentHeight: CGFloat = 144 + 12 + 52 + 12 + 5
    private static let slideCount = 4

    var body: some View {
        VStack(spacing: 12) {
            ZStack {
                slide(page)
                    .id(page)
                    .transition(slideTransition)
            }
            .frame(width: 257.18, height: 144 + 12 + 52, alignment: .top)
            .clipped()

            PageDots(count: Self.slideCount, current: page)
        }
        .frame(width: Self.size.width)
        .padding(.top, Self.contentTop)
        .frame(width: Self.size.width, height: Self.size.height, alignment: .top)
        .contentShape(Rectangle())
        .gesture(swipe)
        .modifier(Materialize(opacity: visible ? 1 : 0, scale: visible ? 1 : 0.96, y: visible ? 0 : 14))
        .animation(.spring(duration: 0.6, bounce: 0), value: visible)
        .task(id: visible) { await autoAdvance() }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isImage)
    }

    // MARK: - Slides

    @ViewBuilder
    private func slide(_ index: Int) -> some View {
        VStack(spacing: 12) {
            art(index)
                .frame(width: 257.18, height: 143.83)
            VStack(spacing: 2) {
                Text(title(index))
                    .font(.custom(FieldTextStyle.h20Bold.fontName, size: FieldTextStyle.h20Bold.size))
                    .tracking(FieldTextStyle.h20Bold.letterSpacing)
                    .foregroundStyle(Color(fieldHex: 0xFCFCFD))
                Text(subtitle(index))
                    .font(.custom(FieldTextStyle.b16Regular.fontName, size: FieldTextStyle.b16Regular.size))
                    .tracking(FieldTextStyle.b16Regular.letterSpacing)
                    .foregroundStyle(FieldPalette.Grey.c400)
            }
            .lineLimit(1)
            .minimumScaleFactor(0.8)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 11)
            .frame(height: 52)
        }
    }

    private func title(_ index: Int) -> String {
        switch index {
        case 0: lang.t("Get everything in minute", "كل ما تحتاجه في دقائق")
        case 1: lang.t("20M+ products", "أكثر من 20 مليون منتج")
        case 2: lang.t("noon One Credit Card", "بطاقة نون ون الائتمانية")
        default: lang.t("Free delivery with one", "توصيل مجاني مع ون")
        }
    }

    private func subtitle(_ index: Int) -> String {
        switch index {
        case 0: lang.t("groceries, essentials, and more", "بقالة، أساسيات، والمزيد")
        case 1: lang.t("from global brands you love", "من علامات عالمية تحبها")
        case 2: lang.t("up to 20% savings, every day", "توفير حتى ٢٠٪ كل يوم")
        default: lang.t("save big on every order", "وفّر أكثر مع كل طلب")
        }
    }

    @ViewBuilder
    private func art(_ index: Int) -> some View {
        switch index {
        case 0: MinutesArt()
        case 1:
            Image(FieldArt.heroIllustration)
                .resizable()
                .scaledToFit()
                .frame(width: 230, height: 134)
        case 2:
            ZStack {
                Image(FieldArt.noonOneCardShadow)
                    .resizable()
                    .frame(width: 200, height: 6)
                    .offset(y: 52)
                Image(FieldArt.noonOneCard)
                    .resizable()
                    .frame(width: 160, height: 100)
                    .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                    .rotationEffect(.degrees(-8))
            }
        default:
            ZStack {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color(fieldHex: 0xFEF8EC))
                    .frame(width: 126.685, height: 143.83)
                Image(FieldArt.noonOne)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 92)
                Image(FieldArt.sparkle).resizable().frame(width: 15.24, height: 15.24).offset(x: 76, y: -28)
                Image(FieldArt.sparkle).resizable().frame(width: 15.24, height: 15.24).offset(x: -78, y: 6)
            }
        }
    }

    // MARK: - Motion

    private var slideTransition: AnyTransition {
        if reduceMotion { return .opacity }
        let sign = direction * (lang.isRTL ? -1 : 1)
        return .asymmetric(
            insertion: .modifier(active: Materialize(opacity: 0, blur: 6, x: 60 * sign), identity: Materialize()),
            removal: .modifier(active: Materialize(opacity: 0, blur: 6, x: -60 * sign), identity: Materialize())
        )
    }

    private func go(to next: Int, direction newDirection: CGFloat) {
        direction = newDirection
        withAnimation(.spring(duration: 0.55, bounce: 0)) {
            page = (next + Self.slideCount) % Self.slideCount
        }
    }

    /// One slide every few seconds while it's on screen; a swipe takes over for a while.
    private func autoAdvance() async {
        guard visible, !reduceMotion else { return }
        while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(4))
            guard !Task.isCancelled, !dragging else { continue }
            go(to: page + 1, direction: 1)
        }
    }

    private var swipe: some Gesture {
        DragGesture(minimumDistance: 16)
            .updating($dragging) { _, state, _ in state = true }
            .onEnded { value in
                let dx = value.translation.width * (lang.isRTL ? -1 : 1)
                guard abs(dx) > 40, abs(dx) > abs(value.translation.height) else { return }
                go(to: page + (dx < 0 ? 1 : -1), direction: dx < 0 ? 1 : -1)
            }
    }
}

/// Figma group 1120:180888: the noon Minutes bag on a dark card, two sparkles and two chips.
private struct MinutesArt: View {
    @Environment(\.lang) private var lang

    var body: some View {
        ZStack(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(RadialGradient(colors: [Color(fieldHex: 0x400B0C), Color(fieldHex: 0x210606)], center: UnitPoint(x: 0.5, y: 0.54), startRadius: 0, endRadius: 72))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Color(fieldHex: 0x380A0B), lineWidth: 1))
                .frame(width: 126.685, height: 143.83)
                .offset(x: 53.34)
            Image(FieldArt.sparkle).resizable().frame(width: 15.24, height: 15.24).offset(x: 180.03, y: 43.82)
            Image(FieldArt.sparkle).resizable().frame(width: 15.24, height: 15.24).offset(x: 34.29, y: 78.11)
            Image("minutes-food")
                .resizable()
                .frame(width: 137.82, height: 87.08)
                .offset(x: 47.23, y: 36.9)
            chip(lang.t("superfast delivery", "توصيل فائق السرعة"))
                .offset(x: 0, y: 10.23)
            chip(lang.t("daily essentials", "أساسيات يومية"))
                .offset(x: 157.17, y: 63.82)
        }
        .frame(width: 257.18, height: 143.83, alignment: .topLeading)
        .environment(\.layoutDirection, .leftToRight)
        .accessibilityHidden(true)
    }

    private func chip(_ text: String) -> some View {
        Text(text)
            .font(.custom("Noontree-SemiBold", size: 12))
            .tracking(-0.12)
            .foregroundStyle(.black)
            .fixedSize()
            .padding(.horizontal, 9)
            .frame(height: 18.1)
            .background(Capsule().fill(FieldPalette.Grey.c100))
            .overlay(Capsule().strokeBorder(Color(red: 243 / 255, green: 129 / 255, blue: 129 / 255, opacity: 0.4), lineWidth: 3))
            .shadow(color: .black.opacity(0.1), radius: 2.5, y: 1)
    }
}

/// Page dots: small dots, the current page a wider pill.
private struct PageDots: View {
    let count: Int
    let current: Int

    var body: some View {
        HStack(spacing: 5) {
            ForEach(0..<count, id: \.self) { index in
                Capsule()
                    .fill(Color.white.opacity(index == current ? 1 : 0.4))
                    .frame(width: index == current ? 16 : 5, height: 5)
            }
        }
        .animation(.spring(duration: 0.4, bounce: 0), value: current)
        .accessibilityHidden(true)
    }
}
