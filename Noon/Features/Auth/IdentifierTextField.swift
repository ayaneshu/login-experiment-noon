import SwiftUI
import UIKit

/// UIKit-backed input for the identifier. Formatting happens synchronously inside
/// `shouldChangeCharactersIn`, so digits group as you type, the caret stays where it belongs,
/// and fast typing or pasting can never race a re-format.
struct IdentifierTextField: UIViewRepresentable {
    var flow: AuthFlow
    @Binding var isFocused: Bool
    /// `.phone` for the number pad, `.email` for the email keyboard; `.unknown` for the smart field.
    var keyboard: IdentifierKind = .unknown
    var placeholder: String?
    var accessibilityLabel: String

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeUIView(context: Context) -> UITextField {
        let field = UITextField()
        field.delegate = context.coordinator
        // Field DS H18 Bold, with its tracking, so the muted digit mask lines up behind it.
        field.defaultTextAttributes = [
            .font: FieldTextStyle.h18Bold.uiFont,
            .kern: FieldTextStyle.h18Bold.tracking,
            .foregroundColor: UIColor(FieldColour.TextNIcon.primary),
        ]
        field.tintColor = UIColor(FieldColour.Surface.actionBold)
        field.borderStyle = .none
        applyKeyboard(to: field)
        field.autocapitalizationType = .none
        field.autocorrectionType = .no
        field.spellCheckingType = .no
        field.smartDashesType = .no
        field.smartQuotesType = .no
        field.smartInsertDeleteType = .no
        field.returnKeyType = .continue
        field.setContentHuggingPriority(.defaultLow, for: .horizontal)
        field.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        field.text = flow.input
        return field
    }

    func updateUIView(_ field: UITextField, context: Context) {
        context.coordinator.parent = self
        _ = flow.inputRevision

        if field.text != flow.input {
            field.text = flow.input
            let end = field.endOfDocument
            field.selectedTextRange = field.textRange(from: end, to: end)
        }

        if field.keyboardType != keyboardType {
            applyKeyboard(to: field)
            // Swap the keyboard in place without dropping focus.
            if field.isFirstResponder { field.reloadInputViews() }
        }

        field.accessibilityLabel = accessibilityLabel
        let isRTL = context.environment.layoutDirection == .rightToLeft
        field.semanticContentAttribute = isRTL ? .forceRightToLeft : .forceLeftToRight
        // Numbers and emails are left-to-right text, but in Arabic they should still sit on the
        // same edge as the label and the country code.
        field.textAlignment = isRTL ? .right : .left

        if let placeholder {
            field.attributedPlaceholder = NSAttributedString(
                string: placeholder,
                // Figma: B16 SemiBold in the muted colour.
                attributes: [
                    .foregroundColor: UIColor(FieldColour.TextNIcon.muted),
                    .font: FieldTextStyle.b16SemiBold.uiFont,
                    .kern: FieldTextStyle.b16SemiBold.tracking,
                ]
            )
        } else {
            field.attributedPlaceholder = nil
        }

        // At rest the field lets touches through, so a drag that starts on it moves the sheet; the
        // row's tap focuses it. VoiceOver keeps the field's own activation.
        field.isUserInteractionEnabled = isFocused || UIAccessibility.isVoiceOverRunning

        if isFocused, !field.isFirstResponder {
            Task { @MainActor in field.becomeFirstResponder() }
        } else if !isFocused, field.isFirstResponder {
            Task { @MainActor in field.resignFirstResponder() }
        }
    }

    private var keyboardType: UIKeyboardType {
        keyboard == .phone ? .numberPad : .emailAddress
    }

    private func applyKeyboard(to field: UITextField) {
        field.keyboardType = keyboardType
        field.textContentType = keyboard == .phone ? .telephoneNumber : .username
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: UITextField, context: Context) -> CGSize? {
        CGSize(width: proposal.width ?? 200, height: 26.scaled)
    }

    final class Coordinator: NSObject, UITextFieldDelegate {
        var parent: IdentifierTextField

        init(_ parent: IdentifierTextField) {
            self.parent = parent
        }

        func textFieldDidBeginEditing(_ textField: UITextField) {
            if !parent.isFocused { parent.isFocused = true }
        }

        func textFieldDidEndEditing(_ textField: UITextField) {
            if parent.isFocused { parent.isFocused = false }
        }

        func textFieldShouldReturn(_ textField: UITextField) -> Bool {
            parent.flow.returnKeyPressed()
            return false
        }

        func textField(_ textField: UITextField, shouldChangeCharactersIn range: NSRange, replacementString string: String) -> Bool {
            let current = (textField.text ?? "") as NSString
            var range = range

            // Backspacing over a group space deletes the digit before it instead.
            if string.isEmpty, range.length > 0, range.location > 0,
               current.substring(with: range).allSatisfy(\.isWhitespace) {
                range = NSRange(location: range.location - 1, length: range.length + 1)
            }

            let proposed = current.replacingCharacters(in: range, with: string)
            let caret = min(range.location + (string as NSString).length, (proposed as NSString).length)
            let significantBeforeCaret = (proposed as NSString).substring(to: caret).filter { !$0.isWhitespace }.count

            parent.flow.setInput(proposed)
            let formatted = parent.flow.input
            textField.text = formatted

            // Put the caret back after the same number of meaningful characters.
            var seen = 0
            var offset = 0
            for character in formatted {
                if seen == significantBeforeCaret { break }
                if !character.isWhitespace { seen += 1 }
                offset += character.utf16.count
            }
            if let position = textField.position(from: textField.beginningOfDocument, offset: offset) {
                textField.selectedTextRange = textField.textRange(from: position, to: position)
            }
            return false
        }
    }
}
