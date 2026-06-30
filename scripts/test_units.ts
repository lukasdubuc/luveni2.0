import { formatLength, formatWeight } from "../src/lib/units";
let f=0; const ok=(c:boolean,m:string)=>{console.log(`${c?"  ✓":"  ✗ FAIL:"} ${m}`);if(!c)f++;};
ok(formatLength(12,"imperial")==='12″',"imperial length inches");
ok(formatLength(12,"metric")==="30.5 cm","metric length cm (12in=30.5cm)");
ok(formatWeight(16,"imperial")==="16 oz","imperial weight oz");
ok(formatWeight(16,"metric")==="454 g","metric weight grams");
ok(formatWeight(40,"metric")==="1.13 kg","metric weight kg when >=1000g");
console.log(""); if(f)process.exit(1); else console.log("ALL PASSED ✅");
