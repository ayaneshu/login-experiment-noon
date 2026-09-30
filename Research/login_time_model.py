"""Monte Carlo model of time-to-login for each noon sign-in flow.

Time runs from the sign-in screen being ready (field already autofocused) to the home page
being interactive (the welcome animation hands over to home 2.06s after authentication).

Human steps are lognormal (right-skewed, like real task times), parameterised by median and
sigma. System steps use the app's own timings where they are UX choices, and realistic
production latencies where the prototype uses mocks.
"""
import math
import random
import statistics

random.seed(7)
N = 200_000


def ln(median, sigma):
    return random.lognormvariate(math.log(median), sigma)


def chance(p):
    return random.random() < p


# ---- App timings (from the code) -------------------------------------------------------
DEBOUNCE = 0.20          # lookup debounce after the identifier becomes valid
CASCADE_BULK = 0.42      # pause after an autofilled/pasted code before verifying
CASCADE_TYPED = 0.16     # pause after the 6th typed digit
SUCCESS_HOLD = 0.56      # green "Verified" beat before the welcome starts
PASSWORD_HOLD = 0.25
WELCOME_TO_HOME = 2.06   # welcome overlay starts retracting; home is interactive
RESEND_TIMER = 30.0

# ---- Production latency assumptions ----------------------------------------------------
def api_lookup():   return DEBOUNCE + ln(0.35, 0.5)
def api_send():     return ln(0.50, 0.45)
def api_verify():   return ln(0.45, 0.45)
def sms_delivery(): return ln(4.0, 0.6)        # A2P SMS in the UAE, p90 ~ 8.6s
def email_delivery(): return ln(6.0, 0.7)      # transactional email, p90 ~ 15s
def whatsapp_delivery(): return ln(2.5, 0.5)
def passkey_roundtrip(): return ln(0.40, 0.45)

# ---- Human task times --------------------------------------------------------------------
def orient_identify(): return ln(1.3, 0.45)    # read the screen, decide phone vs email
def orient_card():     return ln(1.1, 0.40)    # recognise own account card and tap


def type_phone():
    t = ln(0.45, 0.3)                            # switch to the 123 layer
    t += sum(ln(0.32, 0.35) for _ in range(10))  # 050 123 4567, own number, chunked
    if chance(0.07):
        t += ln(2.5, 0.4)                        # notice and fix a typo
    return t


def type_email():
    if chance(0.30):                             # QuickType suggests own email
        return ln(1.8, 0.4)
    t = sum(ln(0.30, 0.35) for _ in range(12))   # local part + "@" + "g"
    t += ln(0.9, 0.35)                           # tap the @gmail.com chip / accept ghost
    if chance(0.12):
        t += ln(3.0, 0.4)
    return t


def tap_cta_returning(lookup):
    # Glance at "Welcome back" and tap; if faster than the lookup, the button waits.
    human = ln(0.8, 0.35)
    return max(human, lookup + 0.3), max(0.0, lookup + 0.3 - human)


def tap_cta_new(lookup):
    # The consent line only appears once the lookup says "new", then it gets skimmed.
    return lookup + ln(1.6, 0.5), lookup


def fill_sms_code():
    """Time from SMS arrival to the code being in the field. Returns (time, typed?)."""
    if chance(0.85):                             # tap the "From Messages" suggestion
        return ln(1.1, 0.4), False
    t = ln(1.5, 0.4) + sum(ln(0.35, 0.3) for _ in range(6))  # read banner, type 6 digits
    if chance(0.05):
        t += CASCADE_TYPED + api_verify() + 0.7 + ln(4.0, 0.4)  # wrong digit, error, retype
    return t, True


def verify_code(typed):
    wait = (CASCADE_TYPED if typed else CASCADE_BULK) + api_verify() + SUCCESS_HOLD
    return wait, wait


# ---- Flows -------------------------------------------------------------------------------
def returning_phone_sms():
    t = w = 0.0
    t += orient_identify() + type_phone()
    lookup = api_lookup()
    cta, waited = tap_cta_returning(lookup); t += cta; w += waited
    s = api_send(); t += s; w += s
    d = sms_delivery(); t += d; w += d
    f, typed = fill_sms_code(); t += f
    v, vw = verify_code(typed); t += v; w += vw
    t += WELCOME_TO_HOME; w += WELCOME_TO_HOME
    return t, w


def new_phone_sms():
    t = w = 0.0
    t += orient_identify() + type_phone()
    lookup = api_lookup()
    cta, waited = tap_cta_new(lookup); t += cta; w += waited
    s = api_send(); t += s; w += s
    d = sms_delivery(); t += d; w += d
    f, typed = fill_sms_code(); t += f
    v, vw = verify_code(typed); t += v; w += vw
    t += WELCOME_TO_HOME; w += WELCOME_TO_HOME
    return t, w


def returning_email():
    t = w = 0.0
    t += orient_identify() + type_email()
    lookup = api_lookup()
    cta, waited = tap_cta_returning(lookup); t += cta; w += waited
    s = api_send(); t += s; w += s
    d = email_delivery(); t += d; w += d
    if chance(0.45):                             # Apple Mail: "From Mail" suggestion
        f, typed = ln(1.2, 0.4), False
    else:                                        # Gmail/Outlook app: switch, copy, return
        f = ln(1.2, 0.3) + ln(3.0, 0.5) + ln(1.2, 0.3) + ln(1.5, 0.4) + ln(1.5, 0.4)
        typed = False
    t += f
    v, vw = verify_code(typed); t += v; w += vw
    t += WELCOME_TO_HOME; w += WELCOME_TO_HOME
    return t, w


def returning_password():
    t = w = 0.0
    t += orient_identify() + type_phone()
    lookup = api_lookup()
    cta, waited = tap_cta_returning(lookup); t += cta; w += waited
    s = api_send(); t += s; w += s
    t += ln(2.2, 0.5)                            # read OTP screen, find the tertiary link
    if chance(0.45):                             # Keychain suggestion + Face ID
        t += ln(2.2, 0.4)
    else:
        t += sum(ln(0.42, 0.35) for _ in range(10)) + 2 * ln(0.5, 0.3)
        if chance(0.15):                         # wrong password: error, clear, retype
            miss = api_verify() + 0.8
            t += miss + ln(5.0, 0.4); w += miss
    t += ln(0.6, 0.3)                            # tap Sign in / Go
    v = api_verify() + PASSWORD_HOLD; t += v; w += v
    t += WELCOME_TO_HOME; w += WELCOME_TO_HOME
    return t, w


def whatsapp_after(timer_wait):
    t = w = 0.0
    t += orient_identify() + type_phone()
    lookup = api_lookup()
    cta, waited = tap_cta_returning(lookup); t += cta; w += waited
    s = api_send(); t += s; w += s
    if timer_wait:
        t += RESEND_TIMER; w += RESEND_TIMER     # SMS never arrives; wait for resend
        t += ln(1.5, 0.4)                        # notice the options, tap WhatsApp
        s2 = api_send(); t += s2; w += s2
    d = whatsapp_delivery(); t += d; w += d
    # Open WhatsApp, find and read the code, copy, come back, paste.
    t += ln(0.9, 0.3) + ln(2.5, 0.5) + ln(1.5, 0.35) + ln(1.5, 0.4) + ln(1.0, 0.3)
    v, vw = verify_code(False); t += v; w += vw
    t += WELCOME_TO_HOME; w += WELCOME_TO_HOME
    return t, w


def remembered_otp():
    t = w = 0.0
    t += orient_card()
    s = api_send(); t += s; w += s
    d = sms_delivery(); t += d; w += d
    f, typed = fill_sms_code(); t += f
    v, vw = verify_code(typed); t += v; w += vw
    t += WELCOME_TO_HOME; w += WELCOME_TO_HOME
    return t, w


def remembered_face_id():
    t = w = 0.0
    t += orient_card()
    face = ln(1.0, 0.3); t += face; w += face    # system Face ID sheet + match
    if chance(0.04):
        t += ln(2.5, 0.4)                        # no match: retry
    p = passkey_roundtrip(); t += p; w += p
    t += WELCOME_TO_HOME; w += WELCOME_TO_HOME
    return t, w


FLOWS = [
    ("Remembered account · Face ID (passkey)", remembered_face_id),
    ("Remembered account · one-tap OTP (SMS)", remembered_otp),
    ("Returning · phone · SMS OTP", returning_phone_sms),
    ("New customer · phone · SMS OTP", new_phone_sms),
    ("Returning · phone · password (tertiary)", returning_password),
    ("Returning · email · email OTP", returning_email),
    ("Returning · WhatsApp, as built (after 30s resend)", lambda: whatsapp_after(True)),
    ("Returning · WhatsApp as first channel (what-if)", lambda: whatsapp_after(False)),
]


def pct(sorted_values, p):
    return sorted_values[min(len(sorted_values) - 1, int(p * len(sorted_values)))]


print(f"{'Flow':52} {'median':>7} {'mean':>7} {'p90':>7} {'wait med':>9}")
for name, flow in FLOWS:
    runs = [flow() for _ in range(N)]
    totals = sorted(r[0] for r in runs)
    waits = sorted(r[1] for r in runs)
    print(f"{name:52} {statistics.median(totals):7.1f} {statistics.fmean(totals):7.1f} "
          f"{pct(totals, 0.9):7.1f} {statistics.median(waits):9.1f}")
