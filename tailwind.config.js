const theme = require('./theme.config.js');
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './admin.html', './print.html'],
  theme: {
    extend: {
      colors: {
        brand: theme.THEME.brand,
        price: theme.THEME.price,
        dark: theme.THEME.dark,
        darkText: theme.THEME.darkText,
        light: theme.THEME.light,
        green: theme.THEME.green,
        red: theme.THEME.red,
        amber: theme.THEME.amber,
        blue: theme.THEME.blue,
        yellow: theme.THEME.yellow,
        gray: {
          750: '#2d2d3a',
        }
      }
    }
  }
}
