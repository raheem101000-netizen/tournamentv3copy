import mixpanel from "mixpanel-browser";

mixpanel.init(import.meta.env.VITE_MIXPANEL_TOKEN, {
  track_pageview: true,
});

export default mixpanel;
