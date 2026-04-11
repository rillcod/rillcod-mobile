type NavLike = {
  goBack: () => void;
  canGoBack?: () => boolean;
  navigate: (name: string, params?: object) => void;
};

/**
 * Pops the stack when possible; otherwise navigates to `fallbackRoute`.
 * Keeps hub → detail flows predictable when the stack has no prior screen (e.g. cold start).
 */
export function goBackOrTo(navigation: NavLike, fallbackRoute: string): void {
  if (typeof navigation.canGoBack === 'function' && navigation.canGoBack()) {
    navigation.goBack();
  } else {
    navigation.navigate(fallbackRoute);
  }
}
