# IC research notes (drawer | part | findings | sources | confidence)
conf: A = manufacturer datasheet / several shops agree, B = one specialist shop, C = forum / weak, X = not found

## ic-asic
7-1 | 30566 | Bosch multi-driver «خرچنگی», QFP-64. Drives double relay, injectors, fan, check lamp, canister purge valve, O2 heater, A/C. ECU Bosch ME7.4.5. Alt: 30536, 30620, TLE6244X, 40055 | ecunoyan.com/آیسی-30566, nasicoelec | B
15-1 | 30536 | Same family as 30566, QFP-64. Fan, A/C, double relay, O2 heater, canister valve, check lamp. ME7.4.5: Peugeot 206, Pride, Zamyad, Samand (EF7). Alt 30566, 30620, TLE6244X | microbartar.com/product/ic-30536-smd, digighate | B
20-1 | 30595 | Bosch, SOP-36 (PowerSO-36). Supply regulator + engine speed (RPM) output + diagnostic line (K-line). Alt 30606, 30430, 30402, 30343, 30639, 30604 | ecunoyan.com/آیسی-30595, nasicoelec 30639 | B
10 | A2C08350 ATIC39 B4 | Continental/Siemens low-side power driver: injectors, relays, fuel pump, purge valve. HQFP-64. Siemens/Continental ECUs (VW Jetta family, Chevrolet Cruze ECM) | uelectronics.com/producto/atic39-b4-driver-para-ecu, community.st.com | C
13 | U705 SDIC03 | ST-made ECU IC, no public datasheet; function not confirmed | community.st.com (datasheet request) | X
11 | A2C33648 ATIC17 E1 | Siemens/Continental voltage-regulator IC (one shop listing only) | digighate.com/category/AUTOMOTIVE-IC | C
21 | 40055 | Bosch/SSAT multi-driver «خرچنگی», QFP-64: double relay, injectors, fan, check lamp, canister valve, O2 heater, A/C. Alt TLE6244, 30620, 30536 | ecunoyan 40055, nasicoelec TLE6244 | B
28 | 30348 | Bosch electronic throttle (drive-by-wire) motor driver, Bosch ME7.4.4; Samand, Peugeot 206/207 throttle bodies | nasicoelec ME7.4.4 teardown, voltatech | B
31 | 30028 | Bosch ignition-coil IGBT driver, D2PAK (TO-263) 3-pin; ECUs ME7.4.4, M7.4.4, M7.9.7.1; Peugeot 206, 405 | nasicoelec.ir/store/parts-ecu/product/46-30028- | B
33 | 30620 | Bosch multi-driver «خرچنگی», QFP-64 (TLE6244 family), ME7.4.9: injectors, O2 heater, fan… Alt TLE6244X, 30536, 40055 | microbartar, nasicoelec TLE6244, carhamrah | B
35 | 30344 | Bosch multi-driver «خرچنگی», QFP-64; Bosch 7.4.4 / ME7.4.4: double relay, injectors, fan, check lamp, canister, O2 heater, A/C; Peugeot 206 type 5, 405, Pars. Alt 40038, 48007, 30403, 30621, 30578, 30614, 30579 | ecunoyan 30344, voltatech | B
36 | 07096 | listed as a transistor next to the 30028 ignition IGBT; no specs | nasicoelec (related item) | C
32 | 30621 | Bosch multi-driver «خرچنگی», QFP-64; M7.4.5, ME7.4.9NG: injectors, double relay, O2 heater… Alt 30578, 30614, 30403, 48007 | nasicoelec 27-30621, ecunoyan 30621, elecsam | A
34 | 30578 | Bosch multi-driver «خرچنگی», QFP-64; injectors, double relay, check lamp, canister purge, O2 heater, fan, A/C; ECUs M7.4.4, ME7.4.9(NG), M7.9.7.1; Peugeot 405/Pars/Samand/Dena, Pride, Zamyad. Alt 30344, 30403, 30579, 30614, 30621, 48007 | nasicoelec 34-30578, ecunoyan 30578 | A
40-1 | 30622 | only listed next to 30578 (out of stock); function not stated | nasicoelec (related item) | X
41-1 | 30424 | Bosch knock-sensor signal processor (detects knocking/detonation), PLCC-28; ECUs ME7.4.9NG, M7.9.7, M7.4.4, ME7.4.5 (IKCO, Saipa) | nasicoelec.ir/store/parts-ecu/product/28-30424- | B
52-1 | 7935 | not found | - | X
54-1 | E310A | Mitsubishi ignition-coil driver IC (pulses from MCU -> coil primary) in Mitsubishi ECUs, Mazda 323; PLCC-44 | nasicoelec.ir/store/parts-ecu/product/80-e310a | B
55-1 | 30637 | not found | - | X
63 | 30639 | Bosch regulator + engine-speed (RPM) output + diagnostic-tool line; ME7.4.4. Same group as 30595 (SOP-36) | elecsam.com/product/30639, nasicoelec 36-30639-, ecunoyan 30595 | B
58 | VALEO JCI 21680386-3-C | not found | - | X
65-1 | A2C00059561 ATIC140C0 | not found | - | X
13 | U705 SDIC03 (UPDATE) | Stepper-motor driver (idle-air control valve) in Siemens ECUs: SIM2K/Siemens, bifuel, EF7, L90 | elecsam.com/product/u705, nasicoelec teardowns (siemens bifuel/EF7/L90) | B
71-1 | 40048 | Bosch ECU IC, QFP-64; replacement 40049; function not stated | ecunoyan SMD list, nasicoelec 1224-40049- | C
76-1 | 30615 | not found | - | X
88 | 66413 | not found | - | X
88-1 | 30520 | Bosch IC in EDC7 diesel ECUs (Mercedes-Benz, IVECO, MAN trucks), QFP-64 | nasicoelec.ir/store/parts-ecu/product/349-30520- , elecsam | B
95-1 | SC900656VW A2C020162 ATIC59 2 C1 | not found in shops | - | X
108-1 | A2C31376-C3 ATIC35 | not found | - | X
109 | 00210 | not found | - | X
111-1 | APIC-D06 | not found in Iranian shops | - | X
112-1 | APIC-D05 | not found in Iranian shops | - | X
113-1 | APIC-D18 | not found in Iranian shops | - | X
118 | A2C0068400 ATIC231 B1 | not found | - | X
119 | A2C59562 | not found | - | X
119-1 | 28192758 | not found | - | X
120 | A2C00693000 UM31CG | not found | - | X
120-1 | 40056 | Bosch ECU IC, listed as a substitute for 48017 (64-pin); function not stated | nasicoelec 265-48017- | C
124-1 | 48007 | Bosch multi-driver «خرچنگی», QFP-64: double relay, injectors, fan, check lamp… Alt 30621, 30578, 30579, 30403, 30344, 40038 | nasicoelec 30578/40042, ecunoyan 30344/30621/30614 | A
133 | 30343 | Bosch: same group as 30595/30639 (supply regulator + engine-speed output + diagnostic line); listed as their substitute | ecunoyan 30595, nasicoelec 30639 | B
131-1 | 30490 | listed only, no description | nasicoelec (related) | X
136-1 | 40036 | Bosch: substitute in the 30639 group (regulator + RPM output + diagnostics); IKCO, Saipa, Hyundai Verna | nasicoelec 36-30639- | B
149 | 48017 | Bosch, QFP-64: injector and relay driver; M7.4.4, M7.9.7.1; Peugeot 206, 405, Pars, Samand, Pride. Alt 40056 | nasicoelec.ir/store/parts-ecu/product/265-48017- | B
156 | 30591 | Bosch injector driver IC | elecsam.com/product/30591 | B
157 | 30572 | Bosch automotive ECU IC; function not stated | digighate AUTOMOTIVE-IC | C
188 | 40076 | not found | - | X
194 | 40042 | Bosch multi-driver «خرچنگی», QFP-64; ME7.4.4, M7.9.7.1: injectors, double relay, fan, O2 heater. Alt 30403, 30578, 30579, 30614, 30621, 48007 | nasicoelec.ir/store/parts-ecu/product/388-40042- | B
199 | 40049 | Bosch, QFP-64: injectors, fan, A/C, double relay; IKCO 206 ECUs. Alt 40048 | nasicoelec.ir/store/parts-ecu/product/1224-40049- , ecunoyan | B
71-1 | 40048 (UPDATE) | same function as 40049 (its listed twin): injectors, fan, A/C, double relay, QFP-64 | nasicoelec 1224-40049- | B
197 | 30046 | not found | - | X
231 | 30358 | ECU IC in a TO-220-15 (Multiwatt-15) package; function not stated | microbartar 30578 page (related) | C
239 | 30522 | listed only | nasicoelec (related) | X
242 | 40038 | Bosch multi-driver «خرچنگی», QFP-64: relays, injectors, fan… Alt 30621, 30578, 30614, 30579, 30403, 30344 | ecunoyan.com/آیسی-40038 | B
228 | E322A | not found (E310A is a Mitsubishi coil driver, maybe same family - not confirmed) | - | X
230 | E351 | not found | - | X
196 | 7936 | very likely NXP PCF7936 immobilizer transponder (key-chip tag), sold in Iran as «تگ سوییچ 7936»; not confirmed it is that item | ecunoyan تگ سوییچ PCF7936 | C
52-1 | 7935 (UPDATE) | likely NXP PCF7935 immobilizer transponder (same family as 7936) - unconfirmed | - | C
204 | 6A930 | listed only | nasicoelec (related) | X
141 | 4AK19 | not found | - | X
158 | C5664 | not found | - | X
190 | SAGEM S2000 | name of the Sagem S2000 ECU (Peugeot 206 TU); which chip this item is is unclear | nasicoelec S2000 pages | X
CONTEXT S2000 ECU (Sagem, 206 TU2/TU5): ST10F273/275 MCU (MQFP-144), M95080 EEPROM, L9930 stepper (idle), L9615D CAN, TLE6220 injector/canister 4ch, HIP9011 knock, SAK-C167CR | nasicoelec S2000 pages | B
111-1 | APIC-D06 (UPDATE) | multifunction ECU ASIC: built-in voltage regulators + low-side power drivers for injectors, ECM relay and fuel-pump relay; HQFP-64; Hitachi/Nissan ECUs (aluminium case). A shorted 5 V regulator inside can kill the ECU | uelectronics.com/producto/apic-d06-driver-para-ecu, besomi | C
112-1 | APIC-D05 | same APIC family as APIC-D06 (Hitachi/Nissan ECU ASIC) - function of D05 not confirmed | (family) | X
113-1 | APIC-D18 | same APIC family - not confirmed | (family) | X
66-1 | 0990-9379/1D3 | not searched in detail; no public source expected (Delphi-style code) | - | X
69-1 | GEC44 TYZ94077EG 3A G | not found | - | X
125-1 | 28177275 | not found (Delphi-style number) | - | X
130-1 | 21093-001 | not found | - | X
139-1 | 990-9407.1D P105071D1 | not found | - | X
141-1 | 00211 | not found | - | X
144 | ATIC94D1 UN94DA | not found | - | X
140-1 | MLX14607B A2C55483 ATIC135/B3 | not found | - | X
152 | MGH80ASC900771AAE | not found | - | X
159 | SE742 5L13 | not found | - | X
160 | JCI21644868-8 | not found | - | X
232 | SC900950AE | not found (Freescale custom prefix SC9) | - | X
235 | 7030-2A | not found | - | X
250 | SC74822 AVW | not found | - | X
253 | B59233 1037350115 | not found | - | X
