const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

let scriptLoaded = false;

function loadGisScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
      scriptLoaded = true;
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      scriptLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load Google Sign-In'));
    document.head.appendChild(script);
  });
}

/**
 * Opens the Google One-Tap / popup sign-in flow and returns the credential (id_token).
 */
export async function getGoogleCredential(): Promise<string> {
  if (!CLIENT_ID) {
    throw new Error('Google Client ID is not configured');
  }

  await loadGisScript();

  const google = (window as any).google;
  if (!google?.accounts?.id) {
    throw new Error('Google Identity Services not available');
  }

  return new Promise<string>((resolve, reject) => {
    google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: (response: { credential?: string }) => {
        if (response.credential) {
          resolve(response.credential);
        } else {
          reject(new Error('Google Sign-In was cancelled'));
        }
      },
      cancel_on_tap_outside: true,
    });

    google.accounts.id.prompt((notification: any) => {
      // If One-Tap is dismissed or not displayed, fall back to the button-style popup
      if (
        notification.isNotDisplayed() ||
        notification.isSkippedMoment() ||
        notification.isDismissedMoment()
      ) {
        // Use the FedCM / popup flow as fallback
        usePopupFallback(google, resolve, reject);
      }
    });
  });
}

function usePopupFallback(
  google: any,
  _resolve: (token: string) => void,
  reject: (err: Error) => void
) {
  // Create a temporary hidden container, render the sign-in button, and auto-click it
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-9999px';
  document.body.appendChild(container);

  google.accounts.id.renderButton(container, {
    type: 'standard',
    size: 'large',
  });

  // Give the button a moment to render, then click it
  setTimeout(() => {
    const btn = container.querySelector<HTMLElement>('[role="button"]') ?? container.querySelector<HTMLElement>('div[tabindex]');
    if (btn) {
      btn.click();
    } else {
      document.body.removeChild(container);
      reject(new Error('Google Sign-In popup could not be opened'));
    }
    // Clean up after a delay
    setTimeout(() => {
      if (container.parentNode) document.body.removeChild(container);
    }, 60000);
  }, 100);
}
