/**
 * Location detection: the browser's Geolocation API (which prompts the user
 * for permission — nothing runs without that native consent dialog) followed
 * by a reverse-geocode lookup against BigDataCloud's free, keyless
 * client-side endpoint to turn coordinates into a US state. Runs
 * automatically on a first visit with no saved or shared plan, purely to
 * pick a better starting default than a hardcoded state.
 */

function detectMyState(callback) {
  if (!navigator.geolocation) {
    callback(new Error("Location detection isn't available in this browser — pick your state below."));
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`)
        .then((res) => res.json())
        .then((data) => {
          const code = data.principalSubdivisionCode; // e.g. "US-CA"
          const stateCode = code && code.startsWith("US-") ? code.slice(3) : null;
          if (stateCode && STATE_DATA[stateCode]) {
            callback(null, stateCode);
          } else {
            callback(new Error("Couldn't match your location to a US state — pick one below."));
          }
        })
        .catch(() => callback(new Error("Couldn't reach the location lookup service — pick your state below.")));
    },
    (error) => {
      if (error.code === error.PERMISSION_DENIED) {
        callback(new Error("Location permission denied — pick your state below."));
      } else {
        callback(new Error("Couldn't determine your location — pick your state below."));
      }
    },
    { timeout: 10000 }
  );
}
