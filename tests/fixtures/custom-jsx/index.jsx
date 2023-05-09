const a = sortMeFn("sm:p-1 p-2");
const b = sortMeFn({
  foo: "sm:p-1 p-2",
});

const c = dontSortFn("sm:p-1 p-2");
const d = sortMeTemplate`sm:p-1 p-2`;
const e = dontSortMeTemplate`sm:p-1 p-2`;

const A = (props) => <div className={props.sortMe} />;
const B = () => <A sortMe="sm:p-1 p-2" dontSort="sm:p-1 p-2" />;
