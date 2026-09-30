import SwiftUI
import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        true
    }
}

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private let app = AppModel()

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        // Before any view reads a token: the design scales from 375pt to this screen's width.
        FieldScale.configure(screenWidth: windowScene.screen.bounds.width)
        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = RootHostingController(app: app)
        window.makeKeyAndVisible()
        self.window = window
    }
}

/// SwiftUI can't pick the status bar style per screen, so the root controller reads it from the
/// model: light over the blue, green, orange and dark headers, dark over yellow and white pages.
final class RootHostingController: UIHostingController<RootContainer> {
    private let app: AppModel

    init(app: AppModel) {
        self.app = app
        super.init(rootView: RootContainer(app: app))
        trackStatusBar()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    override var preferredStatusBarStyle: UIStatusBarStyle {
        app.statusBarIsDark ? .darkContent : .lightContent
    }

    private func trackStatusBar() {
        withObservationTracking {
            _ = app.statusBarIsDark
        } onChange: { [weak self] in
            Task { @MainActor in
                guard let self else { return }
                UIView.animate(withDuration: 0.2) { self.setNeedsStatusBarAppearanceUpdate() }
                self.trackStatusBar()
            }
        }
    }
}

struct RootContainer: View {
    let app: AppModel

    var body: some View {
        RootView()
            .environment(app)
    }
}
