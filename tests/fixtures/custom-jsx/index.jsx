const a = sortMeFn("sm:p-1 p-2");
const b = sortMeFn({
  foo: "sm:p-1 p-2",
});

const c = dontSortFn("sm:p-1 p-2");
const d = sortMeTemplate`sm:p-1 p-2`;
const e = dontSortMeTemplate`sm:p-1 p-2`;
const f = tw.foo`sm:p-1 p-2`;
const g = tw.foo.bar`sm:p-1 p-2`;
const h = no.foo`sm:p-1 p-2`;
const i = no.tw`sm:p-1 p-2`;
const k = tw.foo('sm:p-1 p-2');
const l = tw.foo.bar('sm:p-1 p-2');
const m = no.foo('sm:p-1 p-2');
const n = no.tw('sm:p-1 p-2');

const o = tw.foo`hover:(sm:p-2 p-3) sm:p-1 p-2`;
const p = tw.foo`sm:p-1 hover:(sm:p-2 p-3) focus:(sm:p-2 p-3) p-2`;

const A = (props) => <div className={props.sortMe} />;
const B = () => <A sortMe="sm:p-1 p-2" dontSort="sm:p-1 p-2" />;
