import SwiftUI

struct CountryPicker: View {
    let selected: Country
    var onSelect: (Country) -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(\.lang) private var lang
    @State private var query = ""

    private var others: [Country] {
        Country.all
            .filter { !Country.suggested.contains($0) }
            .sorted { $0.name(lang) < $1.name(lang) }
    }

    private var results: [Country] {
        let needle = query
            .trimmingCharacters(in: .whitespaces)
            .replacingOccurrences(of: "+", with: "")
            .lowercased()
        return Country.all.filter {
            $0.name.lowercased().contains(needle)
                || $0.nameAR.contains(needle)
                || $0.dialCode.hasPrefix(needle)
                || $0.id.lowercased() == needle
        }
    }

    var body: some View {
        NavigationStack {
            List {
                if query.isEmpty {
                    Section(lang.t("Suggested", "مقترحة")) {
                        ForEach(Country.suggested) { row($0) }
                    }
                    Section(lang.t("All countries", "كل الدول")) {
                        ForEach(others) { row($0) }
                    }
                } else if results.isEmpty {
                    ContentUnavailableView.search(text: query)
                } else {
                    Section {
                        ForEach(results) { row($0) }
                    }
                }
            }
            .searchable(
                text: $query,
                placement: .navigationBarDrawer(displayMode: .always),
                prompt: lang.t("Country or code", "الدولة أو الرمز")
            )
            .navigationTitle(lang.t("Country code", "رمز الدولة"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func row(_ country: Country) -> some View {
        Button {
            onSelect(country)
            dismiss()
        } label: {
            HStack(spacing: 14) {
                Text(country.flag)
                    .font(.system(size: 26))
                Text(country.name(lang))
                    .font(.system(size: 17))
                    .foregroundStyle(Palette.ink)
                Spacer()
                Text(ltr("+\(country.dialCode)"))
                    .font(.system(size: 17))
                    .monospacedDigit()
                    .foregroundStyle(Palette.ink2)
                if country == selected {
                    Image(systemName: "checkmark")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Palette.accent)
                }
            }
            .contentShape(Rectangle())
        }
        .accessibilityAddTraits(country == selected ? .isSelected : [])
    }
}
