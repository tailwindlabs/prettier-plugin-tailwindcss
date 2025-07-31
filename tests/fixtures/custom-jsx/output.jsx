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
const o = tw(Foo)`p-2 sm:p-1`;
const p = tw(Foo)(Bar)`p-2 sm:p-1`;
const q = no(Foo)`sm:p-1 p-2`;
const r = no.tw(Foo)`sm:p-1 p-2`;
const s = tw(Foo)("p-2 sm:p-1");
const t = tw(Foo)(Bar)("p-2 sm:p-1");
const u = no(Foo)("sm:p-1 p-2");
const v = no.tw(Foo)("sm:p-1 p-2");
const w = tw.div(Foo)`p-2 sm:p-1`;
const x = tw(Foo).div`p-2 sm:p-1`;
const y = no.tw(Foo)`sm:p-1 p-2`;
const z = no(Foo).tw`sm:p-1 p-2`;

const A = (props) => <div className={props.sortMe} />;
const B = () => <A sortMe="p-2 sm:p-1" dontSort="sm:p-1 p-2" />;
