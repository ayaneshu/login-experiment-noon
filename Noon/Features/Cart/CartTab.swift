import SwiftUI

/// The cart whose Checkout asks a signed-out customer to sign in: the second entry point for
/// sign-in (Figma "E-2 · 0 · Cart (entry)"). Once signed in, Checkout moves on to a placeholder.
struct CartTab: View {
    @Environment(AppModel.self) private var app

    /// The count on the Cart tab in the bottom nav (Figma E-2 · 0).
    static let badgeCount = 2

    var body: some View {
        ZStack {
            if app.showsCheckout && app.phase == .signedIn {
                CheckoutPlaceholder(total: CartPage.total) {
                    withAnimation(.spring(duration: 0.45, bounce: 0)) { app.showsCheckout = false }
                }
                .transition(.move(edge: .trailing).combined(with: .opacity))
            } else {
                CartPage()
                    .transition(.move(edge: .leading).combined(with: .opacity))
            }
        }
        .background(FieldColour.Surface.tertiary.ignoresSafeArea())
    }
}

// MARK: - Page

/// The Figma frame shows the page part-way down: the end of the Global group under the delivery
/// header and the express group in full. The page opens at that same spot and scrolls both ways.
/// Long-press the delivery address (or use the button at the very bottom) for the prototype
/// controls.
private struct CartPage: View {
    @Environment(AppModel.self) private var app
    @Environment(\.lang) private var lang
    @State private var headerHeight: CGFloat = 0
    @State private var positioned = false

    static let total: Double = 1_760
    /// Scrolled to just under the header, this leaves the express group 140pt below it, as drawn.
    private static let restingAnchor = "cart.resting"

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: 12.scaled) {
                    GlobalGroup()
                        .overlay(alignment: .bottom) {
                            // 128pt up from the group's foot, plus the 12pt gap: 140pt above express.
                            Color.clear
                                .frame(height: 128.scaled)
                                .id(Self.restingAnchor)
                                .allowsHitTesting(false)
                        }
                    ExpressGroup()
                    FieldRoundButton(
                        title: lang.t("Prototype controls", "أدوات النموذج التجريبي"),
                        leadingImage: FieldIconName.preferences.assetName,
                        fill: FieldColour.Surface.primary
                    ) {
                        app.showsDemo = true
                    }
                    .padding(.top, 12.scaled)
                }
                .padding(.horizontal, 12.scaled)
                .padding(.top, 8.scaled)
                .padding(.bottom, 16.scaled)
            }
            .scrollIndicators(.hidden)
            .contentMargins(.top, headerHeight, for: .scrollContent)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                CartFooter(total: Self.total)
            }
            .overlay(alignment: .top) {
                header
                    .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { headerHeight = $0 }
            }
            .onChange(of: headerHeight) {
                guard !positioned, headerHeight > 0 else { return }
                positioned = true
                DispatchQueue.main.async { proxy.scrollTo(Self.restingAnchor, anchor: .top) }
            }
        }
        .safeAreaPadding(.bottom, BottomNav.barHeight)
    }

    // MARK: Header

    private var header: some View {
        HStack(spacing: 24.scaled) {
            deliveryAddress
            Button {} label: {
                Image("cart-heart-button")
                    .resizable()
                    .frame(width: 36.scaled, height: 36.scaled)
            }
            .buttonStyle(FieldPressStyle(scale: 0.94))
            .accessibilityLabel(lang.t("Wishlist", "قائمة الأمنيات"))
        }
        .padding(.horizontal, 12.scaled)
        .padding(.top, 4.scaled)
        .padding(.bottom, 8.scaled)
        .background(
            UnevenRoundedRectangle(bottomLeadingRadius: FieldRadius.r16, bottomTrailingRadius: FieldRadius.r16, style: .continuous)
                .fill(FieldPalette.Grey.c50)
                .ignoresSafeArea(edges: .top)
        )
    }

    /// "Home ▾" over the street address. Long-press opens the prototype controls.
    private var deliveryAddress: some View {
        VStack(alignment: .leading, spacing: 2.scaled) {
            HStack(spacing: 4.scaled) {
                Image("cart-address-home")
                    .resizable()
                    .frame(width: 20.scaled, height: 20.scaled)
                HStack(spacing: 2.scaled) {
                    Text(lang.t("Home", "المنزل"))
                        .fieldText(.cartAddressLabel)
                        .foregroundStyle(FieldPalette.Grey.c900)
                        .shadow(color: .black.opacity(0.07), radius: 8, y: 8)
                    Image("cart-chevron-down")
                        .resizable()
                        .frame(width: 16.scaled, height: 16.scaled)
                }
            }
            .padding(.leading, -1.scaled)

            Text(verbatim: "Villa 52, Springville, K, VGP Layout, Mhada Colon")
                .fieldText(.cartAddress)
                .foregroundStyle(FieldPalette.Grey.c700)
                .lineLimit(1)
                .frame(width: 266.scaled, alignment: .leading)
                .padding(.leading, 2.scaled)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
        .onLongPressGesture(minimumDuration: 0.6) { app.showsDemo = true }
        .sensoryFeedback(.impact(weight: .medium), trigger: app.showsDemo) { _, shown in shown }
        .accessibilityElement(children: .combine)
        .accessibilityAction(named: Text(lang.t("Prototype controls", "أدوات النموذج التجريبي"))) { app.showsDemo = true }
    }
}

// MARK: - Fulfilment groups

/// One fulfilment group: a tinted glass card with colour waves and the group's mark, the white
/// items card, and the free-shipping progress strip tucked 24pt under it.
private struct FulfilmentGroup<Mark: View, Items: View>: View {
    struct Look {
        var glass: Color
        var waves: String
        var cardStroke: [Color]
        /// The strip's tint where it meets the card; it fades to white towards the bottom.
        var stripTint: Color
        var progressFill: Color
    }

    let look: Look
    let progressText: String
    @ViewBuilder var mark: Mark
    @ViewBuilder var items: Items

    var body: some View {
        VStack(spacing: -24.scaled) {
            VStack(spacing: 6.scaled) {
                mark
                    .frame(height: 20.scaled)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 20.scaled)

                VStack(spacing: 16.scaled) {
                    items
                    NoonOneCallout()
                }
                .padding(.top, 12.scaled)
                .background(FieldColour.Surface.primary)
                .clipShape(RoundedRectangle(cornerRadius: FieldRadius.r16, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: FieldRadius.r16, style: .continuous)
                        .strokeBorder(LinearGradient(colors: look.cardStroke, startPoint: .top, endPoint: .bottom), lineWidth: 1)
                )
            }
            .padding(.top, 8.scaled)
            .background(alignment: .topLeading) {
                ZStack(alignment: .topLeading) {
                    RoundedRectangle(cornerRadius: FieldRadius.r16, style: .continuous)
                        .fill(look.glass)
                        .strokeBorder(FieldPalette.Grey.c100, lineWidth: 1)
                    Image(look.waves)
                        .resizable()
                        .frame(width: 206.scaled, height: 53.5.scaled)
                        .flipsForRightToLeftLayoutDirection(true)
                        .padding(1.scaled)
                }
            }
            .zIndex(1)

            ProgressStrip(text: progressText, tint: look.stripTint, fill: look.progressFill)
        }
    }
}

private struct GlobalGroup: View {
    @Environment(\.lang) private var lang

    var body: some View {
        FulfilmentGroup(
            look: .init(
                glass: Color(fieldHex: 0xF5F2F7),
                waves: "cart-waves-global",
                cardStroke: [Color(fieldHex: 0xEFC9FB), Color(fieldHex: 0xF9E9FE)],
                stripTint: Color(fieldHex: 0xF9EBFE),
                progressFill: FieldPalette.Neutral.black
            ),
            progressText: lang.t("Add \u{E001} 12 from Global for free shipping", "أضف \u{E001} 12 من جلوبال للشحن المجاني")
        ) {
            HStack(spacing: 1.9.scaled) {
                Image("cart-global-icon")
                    .resizable()
                    .frame(width: 26.6.scaled, height: 24.7.scaled)
                Text(verbatim: "Global")
                    .font(.custom("Noontree-Bold", size: 15.2.scaled))
                    .foregroundStyle(Color(fieldHex: 0x3D4048))
            }
            .padding(.leading, 2.scaled)
            .environment(\.layoutDirection, .leftToRight)
        } items: {
            CartItemRow(line: .globalFirst).padding(.horizontal, 8.scaled)
            Rectangle().fill(Color(fieldHex: 0xEBEBEB)).frame(height: 1).padding(.horizontal, 8.scaled)
            CartItemRow(line: .globalSecond).padding(.horizontal, 8.scaled)
        }
    }
}

private struct ExpressGroup: View {
    @Environment(\.lang) private var lang

    var body: some View {
        FulfilmentGroup(
            look: .init(
                glass: Color(fieldHex: 0xFDFDF1),
                waves: "cart-waves-express",
                cardStroke: [Color(fieldHex: 0xFDF69B), Color(fieldHex: 0xFEFDC8)],
                stripTint: Color(fieldHex: 0xFFFEEF),
                progressFill: FieldPalette.Grey.c1000
            ),
            progressText: lang.t("Add \u{E001} 12 from Express for free shipping", "أضف \u{E001} 12 من إكسبريس للشحن المجاني")
        ) {
            Image("cart-express-wordmark")
                .resizable()
                .frame(width: 64.62.scaled, height: 12.68.scaled)
                .frame(height: 18.scaled)
                .padding(.top, 2.scaled)
                .accessibilityLabel(Text(verbatim: "express"))
        } items: {
            CartItemRow(line: .express).padding(.horizontal, 8.scaled)
        }
    }
}

/// "Save with noon One. Try it now for Free" across the foot of an items card.
private struct NoonOneCallout: View {
    @Environment(\.lang) private var lang

    var body: some View {
        HStack(spacing: 8.scaled) {
            NoonOneMark()
            HStack(spacing: 4.scaled) {
                Text(lang.t("Save with noon One.", "وفّر مع نون وان."))
                    .fieldText(.cartBodyMedium)
                Text(lang.t("Try it now for", "جرّبه الآن"))
                    .fieldText(.cartBody)
                Text(lang.t("Free", "مجاناً"))
                    .fieldText(.cartFree)
                    .foregroundStyle(FieldPalette.Emerald.c700)
            }
            .foregroundStyle(FieldPalette.Grey.c800)
            .lineLimit(1)
        }
        .padding(.horizontal, 12.scaled)
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(height: 40.scaled)
        .background(FieldColour.Surface.primary)
        .overlay(alignment: .top) {
            Rectangle().fill(FieldPalette.Grey.c200).frame(height: 1)
        }
    }
}

/// The noon One logo in its 20pt slot.
private struct NoonOneMark: View {
    var body: some View {
        Image("cart-one-logo")
            .resizable()
            .frame(width: 20.scaled, height: 12.174.scaled)
            .frame(width: 20.scaled, height: 20.scaled)
            .accessibilityHidden(true)
    }
}

/// "Add ₿ 12 from … for free shipping", its progress bar and an Add button.
private struct ProgressStrip: View {
    @Environment(\.lang) private var lang
    let text: String
    let tint: Color
    let fill: Color

    var body: some View {
        HStack(spacing: 8.scaled) {
            VStack(alignment: .leading, spacing: 8.scaled) {
                Text(text)
                    .fieldText(.cartProgress)
                    .foregroundStyle(FieldPalette.Grey.c1000)
                    .lineLimit(1)
                RoundedRectangle(cornerRadius: FieldRadius.r6, style: .continuous)
                    .fill(FieldPalette.Grey.c300)
                    .frame(width: 258.scaled, height: 4)
                    .overlay(alignment: .leading) {
                        RoundedRectangle(cornerRadius: FieldRadius.r2, style: .continuous)
                            .fill(fill)
                            .frame(width: 67.scaled)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: FieldRadius.r6, style: .continuous))
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Button {} label: {
                HStack(spacing: 2.scaled) {
                    Image("cart-add-plus")
                        .resizable()
                        .frame(width: 16.scaled, height: 16.scaled)
                    Text(lang.t("Add", "أضف"))
                        .fieldText(.cartAdd)
                        .foregroundStyle(FieldPalette.Grey.c1000)
                        .fixedSize()
                }
                .padding(.leading, 6.scaled)
                .padding(.trailing, 12.scaled)
                .fixedSize()
                .frame(width: 57.scaled, height: 26.scaled)
                .background(RoundedRectangle(cornerRadius: FieldRadius.r6, style: .continuous).fill(FieldColour.Surface.primary))
                .overlay(
                    RoundedRectangle(cornerRadius: FieldRadius.r6, style: .continuous)
                        .strokeBorder(Color(fieldHex: 0x0E0E0E, alpha: 0.14), lineWidth: 1)
                )
                .contentShape(Rectangle().inset(by: -9))
            }
            .buttonStyle(FieldPressStyle(scale: 0.96))
        }
        .padding(.horizontal, 12.scaled)
        .padding(.top, 36.scaled)
        .padding(.bottom, 16.scaled)
        .frame(maxWidth: .infinity)
        .background(
            LinearGradient(stops: [.init(color: tint, location: 0), .init(color: .white, location: 0.932)],
                           startPoint: .top, endPoint: .bottom)
        )
        .clipShape(UnevenRoundedRectangle(bottomLeadingRadius: FieldRadius.r16, bottomTrailingRadius: FieldRadius.r16, style: .continuous))
    }
}

// MARK: - Items

private enum CartPhoto { case airpods, mug, shampoo }

private enum CartPoint {
    case refund, warranty, nonReturnable, prepaid, fasterDelivery
}

/// One cart line as drawn in Figma. Every line carries the same product title there.
private struct CartLine {
    enum Subtitle { case combo, variants }
    enum Pricing { case offerApplied, regular }
    enum Delivery { case express, scheduled }

    let photo: CartPhoto
    let quantity: Int
    let subtitle: Subtitle
    let pricing: Pricing
    let delivery: Delivery
    /// Coupons and the "Lowest Price in 30 days" badge.
    let showsDeals: Bool
    let points: [[CartPoint]]
    let tertiarySpacing: CGFloat

    static let express = CartLine(
        photo: .airpods, quantity: 2, subtitle: .combo, pricing: .offerApplied, delivery: .express, showsDeals: false,
        points: [[.warranty, .nonReturnable], [.prepaid], [.fasterDelivery]], tertiarySpacing: 8
    )
    static let globalFirst = CartLine(
        photo: .mug, quantity: 2, subtitle: .variants, pricing: .regular, delivery: .scheduled, showsDeals: true,
        points: [[.refund, .nonReturnable], [.fasterDelivery]], tertiarySpacing: 6
    )
    static let globalSecond = CartLine(
        photo: .shampoo, quantity: 1, subtitle: .combo, pricing: .regular, delivery: .scheduled, showsDeals: true,
        points: [[.warranty], [.nonReturnable, .prepaid]], tertiarySpacing: 8
    )
}

private struct CartItemRow: View {
    @Environment(\.lang) private var lang
    let line: CartLine
    @State private var quantity: Int

    init(line: CartLine) {
        self.line = line
        _quantity = State(initialValue: line.quantity)
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12.scaled) {
            VStack(spacing: -16.scaled) {
                photo
                    .frame(width: 104.scaled, height: 144.scaled)
                    .background(FieldPalette.Grey.c100)
                    .clipShape(RoundedRectangle(cornerRadius: FieldRadius.r12, style: .continuous))
                QuantityStepper(quantity: $quantity)
            }
            .frame(width: 104.scaled)

            VStack(alignment: .leading, spacing: 16.scaled) {
                VStack(alignment: .leading, spacing: 10.scaled) {
                    VStack(alignment: .leading, spacing: 4.scaled) {
                        titleRow
                        subtitle
                    }
                    VStack(alignment: .leading, spacing: 8.scaled) {
                        price
                        if line.pricing == .offerApplied { offerApplied }
                        delivery
                    }
                }
                VStack(alignment: .leading, spacing: line.tertiarySpacing.scaled) {
                    if line.showsDeals {
                        CouponsBar()
                        lowestPrice
                    }
                    // Figma's points block is a fixed 60pt: three rows fill it, two leave a gap.
                    VStack(alignment: .leading, spacing: 6.scaled) {
                        ForEach(line.points.indices, id: \.self) { row in
                            HStack(spacing: 12.scaled) {
                                ForEach(line.points[row], id: \.self) { point($0) }
                            }
                        }
                    }
                    .frame(height: 60.scaled, alignment: .topLeading)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    @ViewBuilder
    private var photo: some View {
        switch line.photo {
        case .airpods:
            Image("cart-airpods")
                .resizable()
                .frame(width: 101.88.scaled, height: 101.88.scaled)
                .offset(x: -1.59.scaled)
        case .mug:
            Image("cart-mug")
                .resizable()
                .scaledToFill()
                .frame(width: 104.scaled, height: 144.scaled)
                .clipped()
                .overlay(alignment: .topLeading) {
                    Image("cart-checkbox")
                        .resizable()
                        .frame(width: 24.scaled, height: 24.scaled)
                        .padding(8.scaled)
                }
        case .shampoo:
            Image("cart-shampoo")
                .resizable()
                .scaledToFill()
                .frame(width: 60.scaled, height: 70.scaled)
                .clipped()
        }
    }

    private var titleRow: some View {
        HStack(spacing: 8.scaled) {
            Text(lang.t("Apple Watch Series 9 GPS 41mm Silver Aluminium Case With Storm Blue Sport Band",
                        "ساعة Apple Watch Series 9 بنظام GPS مقاس 41 ملم بهيكل من الألومنيوم الفضي وحزام رياضي بلون Storm Blue"))
                .fieldText(.cartTitle)
                .foregroundStyle(FieldPalette.Grey.c1000)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button {} label: {
                Image("cart-wishlist")
                    .resizable()
                    .frame(width: 16.scaled, height: 16.scaled)
                    .frame(width: 32.scaled, height: 32.scaled)
                    .background(RoundedRectangle(cornerRadius: FieldRadius.r8, style: .continuous).fill(FieldPalette.Grey.c50))
                    .overlay(
                        RoundedRectangle(cornerRadius: FieldRadius.r8, style: .continuous)
                            .strokeBorder(FieldPalette.Grey.c200, lineWidth: 1)
                    )
            }
            .buttonStyle(FieldPressStyle(scale: 0.94))
            .accessibilityLabel(lang.t("Move to wishlist", "انقل إلى قائمة الأمنيات"))
        }
    }

    @ViewBuilder
    private var subtitle: some View {
        switch line.subtitle {
        case .combo:
            HStack(spacing: 4.scaled) {
                Image("cart-combo")
                    .resizable()
                    .scaledToFill()
                    .frame(width: 16.2.scaled, height: 16.2.scaled)
                    .frame(width: 18.scaled, height: 18.scaled)
                HStack(spacing: 2.scaled) {
                    Text(lang.t("Combo", "مجموعة"))
                        .fieldText(.cartChip)
                        .foregroundStyle(FieldPalette.Grey.c800)
                        .frame(height: 18.scaled)
                    Image("cart-info")
                        .resizable()
                        .frame(width: 16.scaled, height: 16.scaled)
                }
            }
            .padding(.horizontal, 6.scaled)
            .padding(.vertical, 2.scaled)
            .background(
                LinearGradient(stops: [.init(color: Color(fieldHex: 0xEAF4FE), location: 0), .init(color: .white, location: 0.854)],
                               startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: FieldRadius.r6, style: .continuous)
            )
        case .variants:
            let separator = run(" · ", .cartChipSeparator)
            let names = [lang.t("256 GB", "256 جيجابايت"), lang.t("Natural Gray", "رمادي طبيعي"),
                         lang.t("WiFi+cellular", "واي فاي + خلوي"), lang.t("Device only", "الجهاز فقط")]
            HStack(spacing: 2.scaled) {
                Text("\(run(names[0], .cartChip))\(separator)\(run(names[1], .cartChip))\(separator)\(run(names[2], .cartChip))\(separator)\(run(names[3], .cartChip))")
                    .foregroundStyle(FieldPalette.Grey.c800)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Image("cart-chevron-right")
                    .resizable()
                    .frame(width: 12.scaled, height: 12.scaled)
                    .frame(width: 16.scaled, height: 16.scaled)
                    .flipsForRightToLeftLayoutDirection(true)
            }
            .padding(.horizontal, 6.scaled)
            .frame(height: 24.scaled)
            .background(FieldPalette.Grey.c100, in: RoundedRectangle(cornerRadius: FieldRadius.r6, style: .continuous))
        }
    }

    @ViewBuilder
    private var price: some View {
        let discount = lang.t("47% OFF", "خصم 47%")
        switch line.pricing {
        case .offerApplied:
            // The list price is struck through as one line: the offer price below replaces it.
            HStack(alignment: .bottom, spacing: 4.scaled) {
                Text(verbatim: "\u{E001}109").fieldText(.cartPrice)
                HStack(alignment: .bottom, spacing: 4.scaled) {
                    Text(verbatim: "\u{E001}209").fieldText(.cartOldPrice)
                    Text(discount).fieldText(.cartDiscount)
                }
                .padding(.bottom, 1.scaled)
            }
            .foregroundStyle(FieldPalette.Grey.c500)
            .overlay(alignment: .top) {
                Rectangle().fill(FieldPalette.Grey.c500).frame(height: 1).offset(y: 11.scaled)
            }
        case .regular:
            HStack(alignment: .bottom, spacing: 4.scaled) {
                Text(verbatim: "\u{E001}109").fieldText(.cartPrice).foregroundStyle(FieldPalette.Grey.c1000)
                HStack(alignment: .bottom, spacing: 4.scaled) {
                    Text(verbatim: "\u{E001}209").fieldText(.cartOldPrice).foregroundStyle(FieldPalette.Grey.c600)
                    Text(discount).fieldText(.cartDiscount).foregroundStyle(FieldPalette.Emerald.c700)
                }
                .padding(.bottom, 1.scaled)
            }
        }
    }

    private var offerApplied: some View {
        HStack(spacing: 4.scaled) {
            Text(verbatim: "\u{E001}95")
                .fieldText(.cartOfferPrice)
                .foregroundStyle(Color(fieldHex: 0x108757))
            Circle()
                .fill(FieldPalette.Grey.c600)
                .frame(width: 3.scaled, height: 3.scaled)
            Text(lang.t("Offer Applied", "تم تطبيق العرض"))
                .fieldText(.cartOfferLabel)
                .foregroundStyle(Color(fieldHex: 0x0E0E0E))
            Image("cart-xmark")
                .resizable()
                .frame(width: 16.scaled, height: 16.scaled)
        }
        .padding(6.scaled)
        .background(
            LinearGradient(colors: [Color(fieldHex: 0xEBFFF4), Color(fieldHex: 0xEBFFF4, alpha: 0.1)],
                           startPoint: .leading, endPoint: .trailing),
            in: RoundedRectangle(cornerRadius: FieldRadius.r6, style: .continuous)
        )
    }

    @ViewBuilder
    private var delivery: some View {
        switch line.delivery {
        case .express:
            HStack(spacing: 4.scaled) {
                Image("cart-flash")
                    .resizable()
                    .frame(width: 14.scaled, height: 14.scaled)
                Text("\(run(lang.t("Get in ", "استلمه خلال "), .cartEta))\(run(lang.t("1 hour 12 mins", "ساعة و12 دقيقة"), .cartEtaBold))")
                    .foregroundStyle(FieldPalette.Supermall.c800)
                    .frame(height: 18.scaled)
            }
            .padding(.horizontal, 6.scaled)
            .padding(.vertical, 4.scaled)
            .background(
                LinearGradient(colors: [Color(fieldHex: 0xF5F5FC), .white], startPoint: .leading, endPoint: .trailing),
                in: RoundedRectangle(cornerRadius: FieldRadius.r6, style: .continuous)
            )
        case .scheduled:
            VStack(alignment: .leading, spacing: 0) {
                Text("\(run(lang.t("Get by ", "استلمه بحلول "), .cartEta).foregroundStyle(FieldPalette.Grey.c900))\(run(lang.t("7th Sep, Saturday", "السبت، 7 سبتمبر"), .cartEtaBold).foregroundStyle(FieldPalette.Grey.c1000))")
                    .frame(height: 18.scaled)
                    .padding(.horizontal, 6.scaled)
                    .padding(.vertical, 4.scaled)
                    .background(
                        LinearGradient(colors: [Color(fieldHex: 0xF6F6F6), .white], startPoint: .leading, endPoint: .trailing),
                        in: RoundedRectangle(cornerRadius: FieldRadius.r6, style: .continuous)
                    )
                Text("\(run(lang.t("Order within ", "اطلب خلال "), .cartBody))\(run(lang.t("1 hrs 20 mins", "ساعة و20 دقيقة"), .cartBodySemiBold))")
                    .foregroundStyle(FieldPalette.Grey.c800)
                    .frame(height: 20.scaled)
                    .padding(.horizontal, 6.scaled)
            }
            // As in Figma, only the date pill takes up room; the cut-off line hangs below it.
            .frame(height: 26.scaled, alignment: .top)
        }
    }

    private var lowestPrice: some View {
        HStack(spacing: 4.scaled) {
            Image("cart-price-drop")
                .resizable()
                .frame(width: 16.scaled, height: 16.scaled)
            Text(lang.t("Lowest Price in 30 days", "أقل سعر خلال 30 يوماً"))
                .fieldText(.cartOfferLabel)
                .foregroundStyle(FieldPalette.Grey.c700)
        }
        .padding(.horizontal, 6.scaled)
        .padding(.vertical, 4.scaled)
        .background(
            LinearGradient(colors: [Color(fieldHex: 0xF3F5FC), .white], startPoint: .leading, endPoint: .trailing),
            in: RoundedRectangle(cornerRadius: FieldRadius.r4, style: .continuous)
        )
    }

    private func point(_ point: CartPoint) -> some View {
        let (icon, title): (String?, String) = switch point {
        case .refund: (nil, lang.t("2x Refund", "استرداد مضاعف"))
        case .warranty: ("cart-warranty", lang.t("1 year warranty", "ضمان لمدة سنة"))
        case .nonReturnable: ("cart-nonreturnable", lang.t("non-returnable", "غير قابل للإرجاع"))
        case .prepaid: ("cart-prepaid", lang.t("Prepaid only", "الدفع المسبق فقط"))
        case .fasterDelivery: ("cart-fastdelivery", lang.t("Faster Delivery at checkout", "توصيل أسرع عند الدفع"))
        }
        return HStack(spacing: 4.scaled) {
            // Figma's refund glyph is empty; its slot stays.
            Group {
                if let icon { Image(icon).resizable() } else { Color.clear }
            }
            .frame(width: 16.scaled, height: 16.scaled)
            Text(title)
                .fieldText(point == .refund ? .b11Regular : .cartBody)
                .foregroundStyle(FieldPalette.Grey.c900)
                .lineLimit(1)
        }
    }
}

/// − 2 + under the product photo; at one, minus becomes remove.
private struct QuantityStepper: View {
    @Environment(\.lang) private var lang
    @Binding var quantity: Int

    var body: some View {
        HStack(spacing: 8.scaled) {
            Button {
                withAnimation(FieldMotion.Spring.snappy) { quantity = max(1, quantity - 1) }
            } label: {
                Image(quantity > 1 ? "cart-minus" : "cart-trash")
                    .resizable()
                    .frame(width: 16.scaled, height: 16.scaled)
                    .contentShape(Rectangle().inset(by: -10))
            }
            .accessibilityLabel(quantity > 1 ? lang.t("Decrease quantity", "إنقاص الكمية") : lang.t("Remove", "إزالة"))
            Text(verbatim: "\(quantity)")
                .fieldText(.cartStepper)
                .foregroundStyle(Color(fieldHex: 0x0E0E0E))
                .contentTransition(.numericText(value: Double(quantity)))
                .frame(width: 20.scaled)
            Button {
                withAnimation(FieldMotion.Spring.snappy) { quantity += 1 }
            } label: {
                Image("cart-plus")
                    .resizable()
                    .frame(width: 16.scaled, height: 16.scaled)
                    .contentShape(Rectangle().inset(by: -10))
            }
            .accessibilityLabel(lang.t("Increase quantity", "زيادة الكمية"))
        }
        .buttonStyle(FieldPressStyle(scale: 0.9))
        .padding(.horizontal, 12.scaled)
        .frame(height: 38.scaled)
        .background(RoundedRectangle(cornerRadius: FieldRadius.r8, style: .continuous).fill(FieldColour.Surface.primary))
        .overlay(
            RoundedRectangle(cornerRadius: FieldRadius.r8, style: .continuous)
                .strokeBorder(Color(fieldHex: 0xEBEBEB), lineWidth: 1)
        )
    }
}

/// Coupon chips that scroll sideways and fade out at the trailing edge.
private struct CouponsBar: View {
    @Environment(\.lang) private var lang

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 6.scaled) {
                ForEach(0..<4, id: \.self) { _ in
                    HStack(spacing: 2.scaled) {
                        Text(lang.t("Extra 10%  Off - Code ", "خصم إضافي 10% - كود "))
                            .fieldText(.cartDiscount)
                            .foregroundStyle(FieldPalette.Grey.c900)
                            .lineLimit(1)
                        Image("cart-chevron-right")
                            .resizable()
                            .frame(width: 12.scaled, height: 12.scaled)
                            .flipsForRightToLeftLayoutDirection(true)
                    }
                    .padding(.horizontal, 10.scaled)
                    .frame(width: 150.scaled, height: 30.scaled)
                    .background(Color(fieldHex: 0xF6FEFD), in: RoundedRectangle(cornerRadius: FieldRadius.r8, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: FieldRadius.r8, style: .continuous)
                            .strokeBorder(FieldPalette.Emerald.c700.opacity(0.4), lineWidth: 1)
                    )
                }
            }
        }
        .scrollIndicators(.hidden)
        .frame(height: 30.scaled)
        .overlay(alignment: .trailing) {
            LinearGradient(colors: [.white.opacity(0), .white], startPoint: .leading, endPoint: .trailing)
                .frame(width: 30.scaled)
                .flipsForRightToLeftLayoutDirection(true)
                .allowsHitTesting(false)
        }
    }
}

// MARK: - Footer

/// The savings tab and the sticky total + Checkout bar above the nav.
private struct CartFooter: View {
    @Environment(AppModel.self) private var app
    @Environment(\.lang) private var lang
    let total: Double

    var body: some View {
        VStack(alignment: .leading, spacing: -16.scaled) {
            ZStack(alignment: .topLeading) {
                Image("cart-waves-savings")
                    .resizable()
                    .frame(width: 239.scaled, height: 48.scaled)
                    .flipsForRightToLeftLayoutDirection(true)
                    .shadow(color: .black.opacity(0.08), radius: 10, y: -4)
                HStack(spacing: 8.scaled) {
                    saved
                    NoonOneMark()
                }
                .padding(.horizontal, 4.scaled)
                .frame(height: 24.scaled)
                .padding(.leading, 12.scaled)
                .padding(.top, 4.scaled)
            }

            HStack(spacing: 12.scaled) {
                VStack(alignment: .leading, spacing: 4.scaled) {
                    Text(lang.t("Total", "المجموع"))
                        .fieldText(.cartTotalLabel)
                        .foregroundStyle(FieldPalette.Grey.c600)
                    Text(verbatim: "\u{E001} " + total.formatted(.number.precision(.fractionLength(2)).locale(Locale(identifier: "en_US"))))
                        .underline(pattern: .dot)
                        .fieldText(.cartTotal)
                        .foregroundStyle(Color(fieldHex: 0x0E0E0E))
                        .monospacedDigit()
                        .lineLimit(1)
                }
                .padding(.leading, 4.scaled)
                .frame(width: 131.scaled, alignment: .leading)

                FieldButton(
                    title: lang.t("Checkout", "إتمام الشراء"),
                    tone: .checkout,
                    size: .h52,
                    textStyle: .cartCheckout,
                    action: app.beginCheckout
                )
            }
            .padding(.horizontal, 12.scaled)
            .padding(.vertical, 10.scaled)
            .background(
                UnevenRoundedRectangle(topLeadingRadius: FieldRadius.r12, topTrailingRadius: FieldRadius.r12, style: .continuous)
                    .fill(FieldColour.Surface.primary)
                    .shadow(color: .black.opacity(0.08), radius: 10, y: -4)
            )
        }
    }

    /// "₿130 saved!", or "وفّرت ₿130" in Arabic.
    private var saved: some View {
        let amount = Text(verbatim: "\u{E001}130").fieldText(.cartSavedAmount)
        let word = Text(lang.t("saved!", "وفّرت")).fieldText(.cartSaved)
        return HStack(spacing: 2.scaled) {
            if lang == .ar {
                word
                amount
            } else {
                amount
                word
            }
        }
        .foregroundStyle(FieldPalette.Emerald.c700)
    }
}

// MARK: - Styles

/// A run of text in one Field style, for mixing weights inside a single line.
private func run(_ string: String, _ style: FieldTextStyle) -> Text {
    Text(verbatim: string).font(style.font).tracking(style.tracking)
}

private extension FieldButtonTone {
    /// The cart's Checkout: Figma #0057FF.
    static let checkout = FieldButtonTone(
        background: Color(fieldHex: 0x0057FF),
        pressed: Color(fieldHex: 0x0047D1),
        foreground: FieldColour.TextNIcon.onSurfaceBold
    )
}

/// The cart frame's type, set in Noontree. (The delivery header is Figtree in Figma.)
private extension FieldTextStyle {
    static let cartAddressLabel = FieldTextStyle(fontName: "Noontree-Bold", size: 16, lineHeight: 22, letterSpacing: -0.3)
    static let cartAddress = FieldTextStyle(fontName: "Noontree-Regular", size: 13, lineHeight: 18, letterSpacing: -0.3)
    static let cartTitle = FieldTextStyle(fontName: "Noontree-Medium", size: 14, lineHeight: 18, letterSpacing: 0)
    static let cartChip = FieldTextStyle(fontName: "Noontree-Regular", size: 12, lineHeight: 14, letterSpacing: -0.07)
    static let cartChipSeparator = FieldTextStyle(fontName: "Noontree-Medium", size: 12, lineHeight: 14, letterSpacing: 0)
    static let cartPrice = FieldTextStyle(fontName: "Noontree-Bold", size: 16, lineHeight: 20, letterSpacing: -0.16)
    static let cartOldPrice = FieldTextStyle(fontName: "Noontree-Regular", size: 12, lineHeight: 16, letterSpacing: 0)
    static let cartDiscount = FieldTextStyle(fontName: "Noontree-SemiBold", size: 12, lineHeight: 14, letterSpacing: -0.12)
    static let cartOfferPrice = FieldTextStyle(fontName: "Noontree-Bold", size: 14, lineHeight: 18, letterSpacing: -0.14)
    static let cartOfferLabel = FieldTextStyle(fontName: "Noontree-Medium", size: 12, lineHeight: 14, letterSpacing: -0.12)
    static let cartEta = FieldTextStyle(fontName: "Noontree-Regular", size: 13, lineHeight: 18, letterSpacing: 0)
    static let cartEtaBold = FieldTextStyle(fontName: "Noontree-Bold", size: 13, lineHeight: 18, letterSpacing: 0)
    static let cartBody = FieldTextStyle(fontName: "Noontree-Regular", size: 12, lineHeight: 16, letterSpacing: 0)
    static let cartBodyMedium = FieldTextStyle(fontName: "Noontree-Medium", size: 12, lineHeight: 16, letterSpacing: 0)
    static let cartBodySemiBold = FieldTextStyle(fontName: "Noontree-SemiBold", size: 12, lineHeight: 16, letterSpacing: 0)
    static let cartFree = FieldTextStyle(fontName: "Noontree-SemiBold", size: 12, lineHeight: 14, letterSpacing: -0.12)
    static let cartStepper = FieldTextStyle(fontName: "Noontree-Bold", size: 14, lineHeight: 18, letterSpacing: -0.14)
    static let cartProgress = FieldTextStyle(fontName: "Noontree-Medium", size: 13, lineHeight: 16, letterSpacing: -0.26)
    static let cartAdd = FieldTextStyle(fontName: "Noontree-SemiBold", size: 14, lineHeight: 18, letterSpacing: -0.14)
    static let cartSavedAmount = FieldTextStyle(fontName: "Noontree-SemiBold", size: 14, lineHeight: 18, letterSpacing: -0.14)
    static let cartSaved = FieldTextStyle(fontName: "Noontree-Regular", size: 14, lineHeight: 18, letterSpacing: -0.14)
    static let cartTotalLabel = FieldTextStyle(fontName: "Noontree-Medium", size: 12, lineHeight: 14, letterSpacing: -0.12)
    static let cartTotal = FieldTextStyle(fontName: "Noontree-Bold", size: 20, lineHeight: 24, letterSpacing: -0.2)
    static let cartCheckout = FieldTextStyle(fontName: "Noontree-SemiBold", size: 17, lineHeight: 20, letterSpacing: -0.26)
}

// MARK: - Checkout

/// Where checkout carries on once you're signed in. A placeholder for the real flow.
private struct CheckoutPlaceholder: View {
    @Environment(AppModel.self) private var app
    @Environment(\.lang) private var lang
    let total: Double
    var onBack: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: FieldSpace.s16) {
            Button(action: onBack) {
                HStack(spacing: FieldSpace.s4) {
                    FieldIcon(.arrowLeft, size: 20).flipsForRightToLeftLayoutDirection(true)
                    Text(lang.t("Cart", "السلة")).fieldText(.b14SemiBold)
                }
                .foregroundStyle(FieldColour.TextNIcon.primary)
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(FieldPressStyle(scale: 0.96))

            Text(lang.t("Checkout", "إتمام الشراء"))
                .fieldText(.h24Bold)
                .foregroundStyle(FieldColour.TextNIcon.primary)

            VStack(alignment: .leading, spacing: FieldSpace.s12) {
                summaryRow(icon: .navProfile, title: lang.t("Signed in as", "تم تسجيل الدخول باسم"), value: app.session.map { ltr($0.identifier.display) } ?? "")
                Rectangle().fill(FieldColour.Border.primary).frame(height: 1)
                summaryRow(icon: .location, title: lang.t("Deliver to", "التوصيل إلى"), value: lang.t("Add an address", "أضف عنواناً"))
                Rectangle().fill(FieldColour.Border.primary).frame(height: 1)
                summaryRow(icon: .paymentCard, title: lang.t("Pay with", "الدفع بواسطة"), value: lang.t("Choose a payment method", "اختر طريقة الدفع"))
            }
            .padding(FieldSpace.s16)
            .background(RoundedRectangle(cornerRadius: FieldRadius.r16, style: .continuous).fill(FieldColour.Surface.primary))

            Spacer(minLength: 0)

            FieldButton(
                title: lang.t("Place order · \u{E001} \(total.formatted(.number.precision(.fractionLength(2))))", "تأكيد الطلب"),
                tone: .neutral,
                action: {}
            )
            .opacity(0.5)
            .allowsHitTesting(false)
        }
        .padding(.horizontal, FieldSpace.s16)
        .padding(.top, FieldSpace.s8)
        .padding(.bottom, FieldSpace.s16)
        .safeAreaPadding(.bottom, BottomNav.barHeight)
    }

    private func summaryRow(icon: FieldIconName, title: String, value: String) -> some View {
        HStack(spacing: FieldSpace.s12) {
            FieldIcon(icon, size: 24)
                .foregroundStyle(FieldColour.TextNIcon.secondary)
            VStack(alignment: .leading, spacing: FieldSpace.s2) {
                Text(title).fieldText(.b13Regular).foregroundStyle(FieldColour.TextNIcon.tertiary)
                Text(value).fieldText(.b14SemiBold).foregroundStyle(FieldColour.TextNIcon.primary)
            }
        }
    }
}

/// Sign-in from checkout or a link: the same flow full screen, over the current tab, with noon's
/// wordmark and a close button instead of the market and language.
struct AuthModal: View {
    @Environment(AppModel.self) private var app
    let entry: AuthEntry

    var body: some View {
        AuthScreen(
            flow: app.flow,
            leaving: app.celebration != nil,
            expanded: app.celebration != nil && app.celebrationStage != .resolve,
            entry: entry,
            onClose: app.closeAuthEntry
        )
        .id(ObjectIdentifier(app.flow))
    }
}
