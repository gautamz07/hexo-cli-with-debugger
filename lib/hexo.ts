import { magenta } from 'picocolors';
import tildify from 'tildify';
import Promise from 'bluebird';
import Context from './context';
import findPkg from './find_pkg';
import goodbye from './goodbye';
import minimist from 'minimist';
import resolve from 'resolve';
import { camelCaseKeys } from 'hexo-util';
import registerConsole from './console';
import helpConsole from './console/help';
import initConsole from './console/init';
import versionConsole from './console/version';

class HexoNotFoundError extends Error {}

function entry(cwd = process.cwd(), args) {
  args = camelCaseKeys(args || minimist(process.argv.slice(2), { string: ['_', 'p', 'path', 's', 'slug'] }));

  console.log('args logged --->');
  console.log(args);

  console.log('RIGHT AT THE BEGINNING');
  let hexo = new Context(cwd, args);
  let { log } = hexo;

  // Change the title in console
  process.title = 'hexo';

  function handleError(err) {
    if (err && !(err instanceof HexoNotFoundError)) {
      log.fatal(err);
    }

    process.exitCode = 2;
  }

  return findPkg(cwd, args).then(path => {
    console.log('BEFORE path logged +++');
    if (!path) return;
    console.log(path);
    hexo.base_dir = path;

    return loadModule(path, args).catch(err => {
      log.error(err.message);
      log.error('Local hexo loading failed in %s', magenta(tildify(path)));
      log.error('Try running: \'rm -rf node_modules && npm install --force\'');
      throw new HexoNotFoundError();
    });
  }).then(mod => {
    console.log('mod logged');
    console.log(mod);
    console.log('before `registerConsole` call -->');
    if (mod) hexo = mod;
    log = hexo.log;

    registerConsole(hexo);

    return hexo.init();
  }).then(() => {
    let cmd = 'help';
    console.log(args);
    if (!args.h && !args.help) {
      console.log('inside the IF condition for << args.help >>');
      const c = args._.shift();
      if (c && hexo.extend.console.get(c)) cmd = c;
    }

    watchSignal(hexo);

    return hexo.call(cmd, args).then(() => hexo.exit()).catch(err => hexo.exit(err).then(() => {
      // `hexo.exit()` already dumped `err`
      handleError(null);
    }));
  }).catch(handleError);
}

entry.console = {
  init: initConsole,
  help: helpConsole,
  version: versionConsole
};

entry.version = require('../package.json').version as string;

function loadModule(path, args) {
  console.log('INSIDE loadModule --->');
  return Promise.try(() => {
    const modulePath = resolve.sync('hexo', { basedir: path });
    console.log('modulePath');
    console.log(modulePath);
    const Hexo = require(modulePath);

    return new Hexo(path, args);
  });
}

function watchSignal(hexo) {
  process.on('SIGINT', () => {
    hexo.log.info(goodbye());
    hexo.unwatch();

    hexo.exit().then(() => {
      // eslint-disable-next-line no-process-exit
      process.exit();
    });
  });
}

export = entry;
