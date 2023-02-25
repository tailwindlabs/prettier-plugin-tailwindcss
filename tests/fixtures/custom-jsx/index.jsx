const A = (props) => {
  return <div className={props.sortMe}/>;
}

const B = () => {
  return (
    <A
      sortMe="sm:p-1 p-2"
      sortedPatternClassName="sm:p-1 p-2"
      dontSort="sm:p-1 p-2"
    />
  );
}
