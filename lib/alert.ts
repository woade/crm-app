import { Alert, Platform, AlertButton } from 'react-native';

/**
 * Drop-in replacement for Alert.alert that also works in a browser.
 *
 * react-native-web does not implement Alert, so on the deployed site every
 * Alert.alert call was a silent no-op: validation messages, save failures and
 * confirmation prompts all vanished with no sign anything had happened. That
 * turns an ordinary error ("no account with that email") into a button that
 * appears to do nothing.
 *
 * Same signature as Alert.alert, so call sites only change their import.
 * On web it maps to the native browser dialogs:
 *   - one button (or none) -> window.alert
 *   - two or more          -> window.confirm, running the non-cancel button's
 *                             handler on OK and the cancel handler otherwise
 */
export function crossAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    Alert.alert(title, message, buttons);
    return;
  }

  const text = message ? `${title}\n\n${message}` : title;

  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }

  const cancel = buttons.find((b) => b.style === 'cancel');
  const proceed = buttons.find((b) => b.style !== 'cancel') ?? buttons[buttons.length - 1];

  if (window.confirm(text)) {
    proceed?.onPress?.();
  } else {
    cancel?.onPress?.();
  }
}
