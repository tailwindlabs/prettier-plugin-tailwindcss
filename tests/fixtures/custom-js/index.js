const sortMeFn = () => {};
const dontSortFn = () => {};
const a = sortMeFn("sm:p-1 p-2");
const b = sortMeFn({
  foo: "sm:p-1 p-2"
});

const c = dontSortFn("sm:p-1 p-2");
const sortMeTemplate = () => {};
const dontSortMeTemplate = () => {};
const d = sortMeTemplate`sm:p-1 p-2`;
const e = dontSortMeTemplate`sm:p-1 p-2`;
