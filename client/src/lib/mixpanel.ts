import mixpanel from "mixpanel-browser";

mixpanel.init("00a1da5e811921bee743c322ce0f409e", {
  track_pageview: true,
});

export default mixpanel;
