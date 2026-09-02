import AsyncStorage from '@react-native-async-storage/async-storage';

const NO_WEBSITE_ONLY_KEY = 'crm_no_website_only';

// Defaults to true — the whole point of these leads is finding businesses
// without a website, so that's the useful starting view.
export async function getNoWebsiteOnly(): Promise<boolean> {
  const v = await AsyncStorage.getItem(NO_WEBSITE_ONLY_KEY);
  return v === null ? true : v === '1';
}

export async function setNoWebsiteOnly(value: boolean): Promise<void> {
  await AsyncStorage.setItem(NO_WEBSITE_ONLY_KEY, value ? '1' : '0');
}
