export function plural(count:number,one:string,few:string,many:string){const n=Math.abs(count)%100;return n>=11&&n<=14?many:n%10===1?one:n%10>=2&&n%10<=4?few:many;}
