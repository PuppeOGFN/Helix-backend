const COLORS = {
  DARK_GREY: '\x1b[38;2;70;70;70m',
  BLUEISH: '\x1b[38;2;90;120;180m',
  REDISH: '\x1b[38;2;180;60;60m',
  GREENISH: '\x1b[38;2;80;140;80m',
  YELLOWY: '\x1b[38;2;180;140;60m',
  RESET: '\x1b[0m'
};

class Logger {
  timestamp() {
    const now = new Date();
    return `${now.getHours()}:${now.getMinutes() < 10 ? '0' : ''}${now.getMinutes()}:${now.getSeconds() < 10 ? '0' : ''}${now.getSeconds()}`;
  }

  discordauth(msg) {
    console.log(`${COLORS.DARK_GREY}${this.timestamp()} | discordauth: ${COLORS.BLUEISH}${msg}${COLORS.RESET}`);
  }

  database(msg) {
    console.log(`${COLORS.DARK_GREY}${this.timestamp()} | db: ${COLORS.BLUEISH}${msg}${COLORS.RESET}`);
  }

  backend(msg) {
    console.log(`${COLORS.DARK_GREY}${this.timestamp()} | backend: ${COLORS.BLUEISH}${msg}${COLORS.RESET}`);
  }

  presence(msg) {
    console.log(`${COLORS.DARK_GREY}${this.timestamp()} | presence: ${COLORS.BLUEISH}${msg}${COLORS.RESET}`);
  }

  bot(msg) {
    console.log(`${COLORS.DARK_GREY}${this.timestamp()} | bot: ${COLORS.BLUEISH}${msg}${COLORS.RESET}`);
  }

  party(msg) {
    console.log(`${COLORS.DARK_GREY}${this.timestamp()} | party: ${COLORS.BLUEISH}${msg}${COLORS.RESET}`);
  }

  arena(msg) {
    console.log(`${COLORS.DARK_GREY}${this.timestamp()} | arena: ${COLORS.BLUEISH}${msg}${COLORS.RESET}`);
  }

  xmpp(msg) {
    console.log(`${COLORS.DARK_GREY}${this.timestamp()} | xmpp: ${COLORS.BLUEISH}${msg}${COLORS.RESET}`);
  }

  error(msg) {
    console.log(`${COLORS.DARK_GREY}${this.timestamp()} | ERR: ${COLORS.REDISH}${msg}${COLORS.RESET}`);
  }

  request(msg) {
    console.log(`${COLORS.DARK_GREY}${this.timestamp()} | req: ${COLORS.BLUEISH}${msg}${COLORS.RESET}`);
  }

  panel(msg) {
    console.log(`${COLORS.DARK_GREY}${this.timestamp()} | panel: ${COLORS.BLUEISH}${msg}${COLORS.RESET}`);
  }

  launcher(msg) {
    console.log(`${COLORS.DARK_GREY}${this.timestamp()} | launcher: ${COLORS.BLUEISH}${msg}${COLORS.RESET}`);
  }

  debug(msg) {
    console.log(`${COLORS.DARK_GREY}${this.timestamp()} | debug: ${COLORS.YELLOWY}${msg}${COLORS.RESET}`);
  }

  warn(msg) {
    console.log(`${COLORS.DARK_GREY}${this.timestamp()} | WARN: ${COLORS.YELLOWY}${msg}${COLORS.RESET}`);
  }

  info(msg) {
    console.log(`${COLORS.DARK_GREY}${this.timestamp()} | info: ${COLORS.BLUEISH}${msg}${COLORS.RESET}`);
  }

  vbucks(msg) {
    console.log(`${COLORS.DARK_GREY}${this.timestamp()} | vbucks: ${COLORS.GREENISH}${msg}${COLORS.RESET}`);
  }

  hype(msg) {
    console.log(`${COLORS.DARK_GREY}${this.timestamp()} | hype: ${COLORS.BLUEISH}${msg}${COLORS.RESET}`);
  }

  xp(msg) {
    console.log(`${COLORS.DARK_GREY}${this.timestamp()} | xp: ${COLORS.BLUEISH}${msg}${COLORS.RESET}`);
  }

  kill(msg) {
    console.log(`${COLORS.DARK_GREY}${this.timestamp()} | KILL: ${COLORS.REDISH}${msg}${COLORS.RESET}`);
  }

  died(msg) {
    console.log(`${COLORS.DARK_GREY}${this.timestamp()} | DIED: ${COLORS.REDISH}${msg}${COLORS.RESET}`);
  }

  win(msg) {
    console.log(`${COLORS.DARK_GREY}${this.timestamp()} | WIN: ${COLORS.GREENISH}${msg}${COLORS.RESET}`);
  }

  api(msg) {
    console.log(`${COLORS.DARK_GREY}${this.timestamp()} | api: ${COLORS.BLUEISH}${msg}${COLORS.RESET}`);
  }

  umbrella(msg) {
    console.log(`${COLORS.DARK_GREY}${this.timestamp()} | umbrella: ${COLORS.BLUEISH}${msg}${COLORS.RESET}`);
  }

  crown(msg) {
    console.log(`${COLORS.DARK_GREY}${this.timestamp()} | crown: ${COLORS.GREENISH}${msg}${COLORS.RESET}`);
  }

  backendstart(msg) {
    console.log(`${COLORS.DARK_GREY}${this.timestamp()} | start: ${COLORS.BLUEISH}${msg}${COLORS.RESET}`);
  }
}

export default new Logger();