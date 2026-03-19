const COLORS = {
  DARK_GREY: '\x1b[38;2;65;65;65m',
  FADED_BLUE: '\x1b[38;2;85;110;170m',
  DULL_RED: '\x1b[38;2;170;50;50m',
  DIRTY_GREEN: '\x1b[38;2;70;130;70m',
  RESET: '\x1b[0m'
};

const log = {
  mm(msg) {
    console.log(`${COLORS.DARK_GREY}${new Date().getHours()}:${new Date().getMinutes() < 10 ? '0' : ''}${new Date().getMinutes()} | mm: ${COLORS.FADED_BLUE}${msg}${COLORS.RESET}`);
  },

  http(msg) {
    console.log(`${COLORS.DARK_GREY}${new Date().getHours()}:${new Date().getMinutes() < 10 ? '0' : ''}${new Date().getMinutes()} | http: ${COLORS.FADED_BLUE}${msg}${COLORS.RESET}`);
  },

  error(msg) {
    console.log(`${COLORS.DARK_GREY}${new Date().getHours()}:${new Date().getMinutes() < 10 ? '0' : ''}${new Date().getMinutes()} | ERR: ${COLORS.DULL_RED}${msg}${COLORS.RESET}`);
  },

  joinable(msg) {
    console.log(`${COLORS.DARK_GREY}${new Date().getHours()}:${new Date().getMinutes() < 10 ? '0' : ''}${new Date().getMinutes()} | join: ${COLORS.FADED_BLUE}${msg}${COLORS.RESET}`);
  },

  notjoinable(msg) {
    console.log(`${COLORS.DARK_GREY}${new Date().getHours()}:${new Date().getMinutes() < 10 ? '0' : ''}${new Date().getMinutes()} | nojoin: ${COLORS.FADED_BLUE}${msg}${COLORS.RESET}`);
  },

  queue(msg) {
    console.log(`${COLORS.DARK_GREY}${new Date().getHours()}:${new Date().getMinutes() < 10 ? '0' : ''}${new Date().getMinutes()} | queued: ${COLORS.DIRTY_GREEN}${msg}${COLORS.RESET}`);
  },

  unqueue(msg) {
    console.log(`${COLORS.DARK_GREY}${new Date().getHours()}:${new Date().getMinutes() < 10 ? '0' : ''}${new Date().getMinutes()} | unqueued: ${COLORS.DIRTY_GREEN}${msg}${COLORS.RESET}`);
  },
};

export default log;