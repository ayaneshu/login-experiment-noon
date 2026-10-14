import SwiftUI

/// Entry point 3 (Figma "E-2b · 0 · Address link (entry)"): a WhatsApp chat where a friend has
/// shared a noon address link. Tapping the link opens noon on Log in; "‹ 12" goes back.
struct AddressLinkChat: View {
    @Environment(AppModel.self) private var app
    @Environment(\.lang) private var lang

    var body: some View {
        VStack(spacing: 0) {
            titleBar
            VStack(spacing: 14.scaled) {
                today
                incoming
                    .frame(maxWidth: .infinity, alignment: .leading)
                outgoing
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
            .padding(.horizontal, 7.scaled)
            .padding(.top, 24.scaled)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .clipped()
            inputBar
        }
        .background(alignment: .top) {
            // The doodle wallpaper runs from the top of the screen to the input bar, as in Figma.
            Image("chat-wallpaper")
                .resizable()
                .scaledToFill()
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                .clipped()
                .ignoresSafeArea(edges: .top)
                .accessibilityHidden(true)
        }
        .background(WhatsApp.bar.ignoresSafeArea())
    }

    // MARK: Title bar

    private var titleBar: some View {
        HStack(spacing: 0) {
            Button(action: app.closeAddressChat) {
                HStack(alignment: .top, spacing: 5.scaled) {
                    Image("chat-chevron-left")
                        .resizable()
                        .frame(width: 11.98.scaled, height: 20.79.scaled)
                        .flipsForRightToLeftLayoutDirection(true)
                    Text(verbatim: "12")
                        .font(.system(size: 17.scaled))
                        .foregroundStyle(WhatsApp.blue)
                        .frame(height: 22.scaled)
                }
                .padding(.horizontal, 9.scaled)
                .padding(.vertical, 10.scaled)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .frame(width: 61.scaled, alignment: .leading)
            .accessibilityLabel(lang.t("Back to chats", "العودة إلى الدردشات"))

            HStack(alignment: .top, spacing: 8.scaled) {
                Image("chat-avatar")
                    .resizable()
                    .scaledToFill()
                    .frame(width: 36.scaled, height: 36.scaled)
                    .clipShape(Circle())
                VStack(alignment: .leading, spacing: 0) {
                    Text(verbatim: "Ayush Kapoor")
                        .font(.custom("Noontree-SemiBold", size: 18.scaled))
                        .foregroundStyle(.white)
                        .frame(height: 22.scaled)
                    Text(lang.t("typing...", "يكتب..."))
                        .font(.system(size: 12.scaled))
                        .foregroundStyle(Color(fieldHex: 0x898989))
                }
                .lineLimit(1)
            }
            .padding(.top, 3.scaled)
            .frame(maxHeight: .infinity, alignment: .top)
            .accessibilityElement(children: .combine)

            Spacer(minLength: 0)

            HStack(spacing: 22.scaled) {
                Image("chat-video").resizable().frame(width: 24.scaled, height: 24.scaled)
                Image("chat-audio").resizable().frame(width: 24.scaled, height: 24.scaled)
            }
            .padding(.trailing, 15.scaled)
            .accessibilityHidden(true)
        }
        .frame(height: 44.scaled)
        .background(alignment: .bottom) {
            Rectangle().fill(WhatsApp.hairline).frame(height: 0.5)
        }
        .background(WhatsApp.bar.ignoresSafeArea(edges: .top))
    }

    // MARK: Messages

    private var today: some View {
        Text(lang.t("Today", "اليوم"))
            .font(.system(size: 12.scaled, weight: .semibold))
            .foregroundStyle(Color(fieldHex: 0xA0A0A0))
            .padding(.horizontal, 34.scaled)
            .padding(.vertical, 2.scaled)
            .background(RoundedRectangle(cornerRadius: 6.scaled, style: .continuous).fill(WhatsApp.bar.opacity(0.9)))
            .shadow(color: Color(fieldHex: 0x8C8C8C, alpha: 0.2), radius: 0.5, y: -1)
    }

    /// The friend's message: map preview, the request and the noon link.
    private var incoming: some View {
        HStack(alignment: .bottom, spacing: 0) {
            Image("chat-tail-in")
                .resizable()
                .frame(width: 8.scaled, height: 15.scaled)
                .scaleEffect(x: -1)
                .flipsForRightToLeftLayoutDirection(true)
            VStack(spacing: 4.scaled) {
                Image("chat-map-preview")
                    .resizable()
                    .frame(width: 284.scaled, height: 156.scaled)
                    .clipShape(RoundedRectangle(cornerRadius: 4.scaled, style: .continuous))
                    .accessibilityLabel(lang.t("Shared location", "موقع مُشارَك"))
                VStack(alignment: .trailing, spacing: 4.scaled) {
                    VStack(alignment: .leading, spacing: 10.scaled) {
                        Text(lang.t("Hey, please use this address to send the order 👇🏻", "مرحباً، استخدم هذا العنوان لإرسال الطلب 👇🏻"))
                            .chatBody()
                            .foregroundStyle(.white)
                        Button(action: app.followAddressLink) {
                            // Breaks after "z75u/" as in Figma; iOS would otherwise avoid the one-word last line.
                            Text(verbatim: ltr("https://noon.onelink.me/z75u/\nbhsxqr9p"))
                                .underline()
                                .chatBody()
                                .foregroundStyle(Color(fieldHex: 0x48B0FF))
                                .multilineTextAlignment(.leading)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(FieldPressStyle(scale: 0.98))
                        .accessibilityHint(lang.t("Opens noon", "يفتح نون"))
                    }
                    .frame(width: 266.scaled, alignment: .leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    timestamp(color: Color(fieldHex: 0x828287))
                        .frame(height: 16.scaled, alignment: .top)
                }
                .frame(width: 274.scaled)
            }
            .padding(3.scaled)
            .background(RoundedRectangle(cornerRadius: 6.scaled, style: .continuous).fill(Color(fieldHex: 0x3C3C3E)))
        }
        .compositingGroup()
        .shadow(color: .black.opacity(0.2), radius: 0.5, y: 1)
    }

    /// The reply. Figma draws its bubble at a fixed 126pt, with the time tucked under the text.
    private var outgoing: some View {
        HStack(alignment: .bottom, spacing: 0) {
            Text(lang.t("Ohh, thanks Rahul for the address! 😄", "شكراً يا راهول على العنوان! 😄"))
                .chatBody()
                .foregroundStyle(.white)
                .frame(width: 274.scaled, height: 110.scaled, alignment: .topLeading)
                .padding(8.scaled)
                .background(RoundedRectangle(cornerRadius: 6.scaled, style: .continuous).fill(Color(fieldHex: 0x056162)))
                .overlay(alignment: .topTrailing) {
                    HStack(alignment: .bottom, spacing: 4.scaled) {
                        timestamp(color: .white.opacity(0.2))
                        Image("chat-ticks")
                            .resizable()
                            .frame(width: 15.scaled, height: 14.scaled)
                    }
                    .padding(.top, 38.scaled)
                    .padding(.trailing, 8.scaled)
                }
            Image("chat-tail-out")
                .resizable()
                .frame(width: 8.scaled, height: 15.scaled)
                .flipsForRightToLeftLayoutDirection(true)
        }
        .compositingGroup()
        .shadow(color: .black.opacity(0.2), radius: 0.5, y: 1)
    }

    private func timestamp(color: Color) -> some View {
        Text(lang.t("9:41 AM", "9:41 ص"))
            .font(.system(size: 12.scaled, weight: .medium))
            .foregroundStyle(color)
            .lineLimit(1)
    }

    // MARK: Input bar

    private var inputBar: some View {
        HStack(spacing: 0) {
            Image("chat-plus").resizable().frame(width: 24.scaled, height: 24.scaled)
                .padding(.trailing, 9.scaled)
            RoundedRectangle(cornerRadius: 15.scaled, style: .continuous)
                .fill(Color(fieldHex: 0x2C2C2E))
                .strokeBorder(WhatsApp.hairline, lineWidth: 1)
                .frame(width: 230.scaled, height: 30.scaled)
                .overlay(alignment: .trailing) {
                    Image("chat-sticker").resizable().frame(width: 24.scaled, height: 24.scaled)
                        .padding(.trailing, 6.scaled)
                }
            Image("chat-camera").resizable().frame(width: 24.scaled, height: 24.scaled)
                .padding(.leading, 17.scaled)
            Image("chat-mic").resizable().frame(width: 24.scaled, height: 24.scaled)
                .padding(.leading, 17.scaled)
        }
        .padding(.horizontal, 13.scaled)
        .padding(.top, 10.scaled)
        .padding(.bottom, 6.scaled)
        .frame(maxWidth: .infinity)
        .background(alignment: .top) {
            Rectangle().fill(WhatsApp.hairline).frame(height: 0.5)
        }
        .background(WhatsApp.bar.ignoresSafeArea(edges: .bottom))
        .accessibilityHidden(true)
    }
}

/// WhatsApp's dark-mode chrome, from the Figma frame.
private enum WhatsApp {
    static let bar = Color(fieldHex: 0x171717)
    static let hairline = Color(fieldHex: 0x4B4B4D)
    static let blue = Color(fieldHex: 0x007AFF)
}

private extension View {
    /// SF Pro 17/22: WhatsApp's message text. (Figma's −0.41 tracking is SF's own default at
    /// this size, which iOS applies by itself.)
    func chatBody() -> some View {
        let font = UIFont.systemFont(ofSize: 17.scaled)
        return self
            .font(.system(size: 17.scaled))
            .lineSpacing(max(0, 22.scaled - font.lineHeight))
    }
}
