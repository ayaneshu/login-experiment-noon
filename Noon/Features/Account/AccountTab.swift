import SwiftUI

/// Signed out it's the sign-in sheet; signed in it's the account page. In between, the sheet grows
/// to fill the screen and becomes the page's background, and the account page takes its place
/// underneath the greeting.
struct AccountTab: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        ZStack {
            if app.phase == .signedOut {
                AuthScreen(
                    flow: app.flow,
                    leaving: app.celebration != nil,
                    expanded: app.celebration != nil && app.celebrationStage != .resolve
                )
                .id(AuthScreenID(flow: ObjectIdentifier(app.flow), lang: app.lang))
                .transition(.opacity)
            } else {
                AccountPage(revealed: app.accountRevealed)
                    .transition(.opacity)
            }
        }
    }
}

/// Rebuilding the auth screen on a language switch gives a clean cross-fade instead of every
/// element sliding to its mirrored position.
private struct AuthScreenID: Hashable {
    let flow: ObjectIdentifier
    let lang: Lang
}
