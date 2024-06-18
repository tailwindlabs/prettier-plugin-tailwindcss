<script setup>
let a = sortMeFn("p-2 sm:p-1");
let b = sortMeFn({ "p-2 sm:p-1": true });
let c = dontSortFn("sm:p-1 p-2");
let d = sortMeTemplate`p-2 sm:p-1`;
let e = dontSortMeTemplate`sm:p-1 p-2`;
</script>
<template>
  <div class="p-2 sm:p-1" sortMe="p-2 sm:p-1" dontSortMe="sm:p-1 p-2"></div>
  <div :class="{ 'p-2 sm:p-1': true }"></div>
  <div :sortMe="{ 'p-2 sm:p-1': true }"></div>
</template>
