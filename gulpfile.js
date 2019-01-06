var pkg = require('./package.json')
var gulp = require('gulp')
var eslint = require('gulp-eslint')
var gulpBrowserify = require('gulp-browserify')
var browserify = require('browserify')
var header = require('gulp-header')
var pump = require('pump')
var uglify = require('gulp-uglify')
var concat = require('gulp-concat')
var sourcemaps = require('gulp-sourcemaps')
var babel = require('gulp-babel')
var source = require('vinyl-source-stream')
var buffer = require('vinyl-buffer')
var babelify = require('babelify')

var name = 'uploader'
var NAME = name.charAt(0).toUpperCase() + name.substr(1)
var fname = name + '.js'
var mname = name + '.min.js'

var paths = {
  src: 'src/',
  dist: 'dist/'
}
var allFiles = paths.src + '*.js'
var banner = [
  '/*!',
  ' * ' + NAME + ' - <%= pkg.description %>',
  ' * @version v<%= pkg.version %>',
  ' * @author <%= pkg.author %>',
  ' * @link <%= pkg.homepage %>',
  ' * @license <%= pkg.license %>',
  ' */',
  ''
].join('\n')

gulp.task('build1', function () {
  // app.js is your main JS file with all your module inclusions
  return (
    browserify({ entries: './src/uploader.js', debug: true })
      .transform('babelify', { presets: ['stage-3'] })
      .bundle()
      .pipe(source('uploader.js'))
      .pipe(buffer())
      .pipe(sourcemaps.init())
      // .pipe(uglify())
      .pipe(sourcemaps.write('./maps'))
      .pipe(gulp.dest('./dist/js'))
  )
})

gulp.task('eslint', function () {
  return gulp
    .src(allFiles)
    .pipe(
      eslint({
        useEslintrc: true
      })
    )
    .pipe(eslint.format())
    .pipe(eslint.failOnError())
})

gulp.task('scripts', ['eslint'], function () {
  return (
    gulp
      .src(paths.src + fname)
      // .pipe(babel({
      //   presets: ['stage-3']
      // }))
      .pipe(
        gulpBrowserify({
          debug: false,
          standalone: 'Uploader',
          transform: ['babelify', 'browserify-versionify']
        })
      )
      .pipe(
        header(banner, {
          pkg: pkg
        })
      )
      .pipe(gulp.dest(paths.dist))
  )
})

gulp.task('build', ['scripts'], function (cb) {
  pump(
    [
      gulp.src(paths.dist + fname),
      sourcemaps.init(),
      // uglify({
      //   output: {
      //     comments: /^!/
      //   }
      // }),
      concat(mname),
      sourcemaps.write('./', {
        includeContent: false
      }),
      gulp.dest(paths.dist)
    ],
    cb
  )
})
