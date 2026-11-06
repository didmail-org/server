// Express 4's depd dynamically generates wrappers; Workers forbids string code generation.
// Preserve the original function (including its arity) and leave warnings to build-time checks.
module.exports = function deprecate() {
  const warning = function () {};
  warning.function = (fn) => fn;
  warning.property = function () {};
  return warning;
};
