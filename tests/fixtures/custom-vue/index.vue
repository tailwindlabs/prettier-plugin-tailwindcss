<script setup>
  let a = sortMeFn("sm:p-1 p-2");
  let b = sortMeFn({"sm:p-1 p-2": true});
  let c = dontSortFn("sm:p-1 p-2");
  let d = sortMeTemplate`sm:p-1 p-2`;
  let e = dontSortMeTemplate`sm:p-1 p-2`;
</script>
<template>
  <div class="sm:p-1 p-2" sortMe="sm:p-1 p-2" dontSortMe="sm:p-1 p-2"></div>
  <div :class="{'sm:p-1 p-2': true}"></div>
  <div :sortMe="{'sm:p-1 p-2': true}"></div>
</template>
