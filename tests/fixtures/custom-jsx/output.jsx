const a = sortMeFn("p-2 sm:p-1");
const b = sortMeFn({
  foo: "p-2 sm:p-1",
});

const c = dontSortFn("sm:p-1 p-2");
const d = sortMeTemplate`p-2 sm:p-1`;
const e = dontSortMeTemplate`sm:p-1 p-2`;
const f = tw.foo`p-2 sm:p-1`;
const g = tw.foo.bar`p-2 sm:p-1`;
const h = no.foo`sm:p-1 p-2`;
const i = no.tw`sm:p-1 p-2`;
const k = tw.foo("p-2 sm:p-1");
const l = tw.foo.bar("p-2 sm:p-1");
const m = no.foo("sm:p-1 p-2");
const n = no.tw("sm:p-1 p-2");

const A = (props) => <div className={props.sortMe} />;
const B = () => <A sortMe="p-2 sm:p-1" dontSort="sm:p-1 p-2" />;
