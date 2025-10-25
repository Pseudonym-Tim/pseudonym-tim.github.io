/**
 * Utility functions with explicit typing via JSDoc.
 */

/** @typedef {number} Float */
/** @typedef {number} Int */
/** @typedef {"physical"|"magical"} AttackType */

/** Clamp a number into [a, b]. */
function clamp(x, a, b)
{
    return Math.min(Math.max(x, a), b);
}

/** Linear interpolation a→b at t∈[0,1]. */
function lerp(a, b, t)
{
    return a + (b - a) * t;
}

/** Floor to Int. */
function ifloor(x)
{
    return Math.floor(x);
}

/** Random in [min, max]. */
function randomRange(min, max)
{
    return Math.random() * (max - min) + min;
}

/**
 * Compute hit chance (Aim vs Agility).
 * HitChance = Clamp(60 + 40 * Aim / (Aim + TargetAgility), 5, 99)
 */
function hitChance(aim, targetAgility)
{
    const base = 60 + 40 * (aim / Math.max(1, (aim + targetAgility)));
    return clamp(base, 5, 99);
}

/**
 * Compute crit chance.
 * CritChance = Clamp(5 + 0.1 * (Luck - TargetLuck), 1, 30)
 */
function critChance(luck, targetLuck)
{
    const base = 5 + 0.1 * (luck - targetLuck);
    return clamp(base, 1, 30);
}

/**
 * Element modifier from target resistance r where:
 * r=0 neutral, r=0.5 means 50% resist, r=-0.5 means 50% weak.
 * ElementModifier = 1 - r
 */
function elementModifierFromResistance(resistance)
{
    return 1 - resistance;
}

/**
 * Physical damage:
 * Base = Power * 0.32 * (100 + Strength)
 * Mitig = 300 / (300 + TargetPhysicalDefense)
 * PhysicalDamage = floor(Base * Mitig * Elem * Variance)
 */
function physicalDamage(power, strength, targetPDef, elemModifier, variance)
{
    const base = power * 0.32 * (100 + strength);
    const mitig = 300 / (300 + targetPDef);
    const v = variance;
    const dmg = base * mitig * elemModifier * v;
    return Math.max(ifloor(dmg), 1);
}

/**
 * Magical damage:
 * Base = Power * 0.28 * (100 + Magic)
 * Mitig = 300 / (300 + TargetMagicDefense)
 * MagicalDamage = floor(Base * Mitig * Elem * Variance)
 */
function magicalDamage(power, magic, targetMDef, elemModifier, variance)
{
    const base = power * 0.28 * (100 + magic);
    const mitig = 300 / (300 + targetMDef);
    const v = variance;
    const dmg = base * mitig * elemModifier * v;
    return Math.max(ifloor(dmg), 1);
}

/** Defending halves incoming damage, applied before clamp. */
function applyDefend(damage, isDefending)
{
    return isDefending ? ifloor(damage * 0.5) : damage;
}

/** Expected (mean) variance multiplier with symmetric uniform ±v is 1.0. */
function expectedVariance(avgPlusMinus)
{
    void avgPlusMinus; // Not used since expectation is 1.0
    return 1.0;
}

/** Sample a variance multiplier from ±v. */
function sampleVariance(avgPlusMinus)
{
    const min = 1 - avgPlusMinus;
    const max = 1 + avgPlusMinus;
    return randomRange(min, max);
}

/**
 * ATB Fill Rate (units per second):
 * ATBFillRate = 8 + 0.12 * Clamp(Speed, 0, 255)
 */
function atbFillRate(speed)
{
    return 8 + 0.12 * clamp(speed, 0, 255);
}

/**
 * Cast interrupt pushback:
 * blended = 0.50*timeValue + 0.35*resourceValue + 0.15*earlyness
 * penaltyRatio = Clamp(Lerp(minPenalty, 0.80, blended), minPenalty, 0.80)
 * NewATB = Max(0, currentATB - currentATB * penaltyRatio * pushbackIntensity)
 */
function castInterruptNewATB(castTime, mpCost, hpCost, castProgress, minPenaltyRatio, pushbackIntensity, currentATB)
{
    const timeValue = clamp(castTime / 3.0, 0, 1);
    const resourceValue = clamp(Math.sqrt((mpCost + hpCost) / 50.0), 0, 1);
    const earlyness = 1 - castProgress;
    const blended = 0.50 * timeValue + 0.35 * resourceValue + 0.15 * earlyness;
    const ratio = clamp(lerp(minPenaltyRatio, 0.80, blended), minPenaltyRatio, 0.80);
    const newATB = Math.max(0, currentATB - currentATB * ratio * pushbackIntensity);
    return { blended: blended, penaltyRatio: ratio, newATB: newATB };
}

/** DOM helpers */
function el(id)
{
    return /** @type {HTMLInputElement} */ (document.getElementById(id));
}

function out(id)
{
    return /** @type {HTMLDivElement} */ (document.getElementById(id));
}

/** Read number value from input. */
function num(id)
{
    return parseFloat(el(id).value || "0");
}

/** Read boolean from checkbox. */
function flag(id)
{
    return el(id).checked;
}

/** Format helpers */
function pct(x)
{
    return x.toFixed(1) + "%";
}

function intfmt(x)
{
    return Math.round(x).toString();
}

const attackType = document.getElementById("attackType");
const resistanceInput = document.getElementById("resistance");

// Disable resistance field if current attack type is physical
resistanceInput.disabled = (attackType.value === "physical");

// Listen for when user changes attack type
attackType.addEventListener("change", function()
{
    const isPhysical = attackType.value === "physical";
    resistanceInput.disabled = isPhysical;

    if(isPhysical)
    {
        resistanceInput.value = 0;
    }

    resistanceInput.title = isPhysical ? "Only applies to Magical attacks" : "";
});

/** Compute and display EXPECTED values (no RNG except hit/crit rates themselves). */
function computeExpected()
{
    const power = num("power");
    const str = num("strength");
    const mag = num("magic");
    const aim = num("aim");
    const luck = num("luck");
    const speed = num("speed");

    const pdef = num("pdef");
    const mdef = num("mdef");
    const agi = num("agility");
    const luckDef = num("luckDef");
    const resistance = num("resistance");
    const elemMod = elementModifierFromResistance(resistance);

    const cannotMiss = flag("cannotMiss");
    const defending = flag("defending");
    const variancePM = num("variance");
    const attackType = /** @type {AttackType} */ (document.getElementById("attackType").value);

    const hc = cannotMiss ? 100 : hitChance(aim, agi);
    const cc = critChance(luck, luckDef);

    const vExpected = expectedVariance(variancePM);

    const baseDamage =
        attackType === "physical"
        ? physicalDamage(power, str, pdef, elemMod, vExpected)
        : magicalDamage(power, mag, mdef, elemMod, vExpected);

    const defended = applyDefend(baseDamage, defending);
    const critDamage = Math.max(ifloor(defended * 1.5), 1);

    const expectedDamage = defended * (1 - cc / 100) + critDamage * (cc / 100);

    out("hitCrit").innerHTML =
        `<div>Hit Chance: <strong>${pct(hc)}</strong>${cannotMiss ? ' <span class="good">(cannot miss)</span>' : ''}</div>
         <div>Crit Chance: <strong>${pct(cc)}</strong></div>`;

    out("damage").innerHTML =
        `<div>Element Modifier: <strong>${elemMod.toFixed(2)}</strong> (From resistance ${resistance})</div>
         <div>Base ${attackType === "physical" ? "Physical" : "Magical"} Damage (No crit, expected variance): <strong>${intfmt(defended)}</strong></div>
         <div>Critical Damage (x1.5): <strong>${intfmt(critDamage)}</strong></div>
         <div class="warn">Expected Damage (Mix of crit and non-crit): <strong>${intfmt(expectedDamage)}</strong></div>`;

    // ATB / Cast block
    const atbRate = atbFillRate(speed);
    const castTime = num("castTime");
    const mpCost = num("mpCost");
    const hpCost = num("hpCost");
    const castProgress = num("castProgress");
    const minPenalty = num("minPenalty");
    const pushbackIntensity = num("pushbackIntensity");
    const currentATB = num("currentATB");

    const push = castInterruptNewATB(castTime, mpCost, hpCost, castProgress, minPenalty, pushbackIntensity, currentATB);

    out("atb").innerHTML =
        `<div>ATB Fill Rate: <strong>${atbRate.toFixed(2)}</strong> units/sec</div>
         <div>Interrupt blended factor: <strong>${push.blended.toFixed(2)}</strong></div>
         <div>Penalty Ratio: <strong>${push.penaltyRatio.toFixed(2)}</strong></div>
         <div>New ATB after interrupt: <strong>${push.newATB.toFixed(1)}</strong></div>`;
}

/** Do a full random “roll”: hit check → damage (with sampled variance) → crit → defend. */
function rollOnce()
{
    const aim = num("aim");
    const agi = num("agility");
    const speed = num("speed");
    const cannotMiss = flag("cannotMiss");
    const hc = cannotMiss ? 100 : hitChance(aim, agi);

    const hitRoll = Math.random() * 100;
    const connects = cannotMiss || (hitRoll <= hc);

    const luck = num("luck");
    const luckDef = num("luckDef");
    const cc = critChance(luck, luckDef);
    const critRoll = Math.random() * 100;
    const isCrit = connects && (critRoll <= cc);

    const power = num("power");
    const str = num("strength");
    const mag = num("magic");
    const pdef = num("pdef");
    const mdef = num("mdef");
    const resistance = num("resistance");
    const elemMod = elementModifierFromResistance(resistance);
    const defending = flag("defending");
    const variancePM = num("variance");
    const attackType = /** @type {AttackType} */ (document.getElementById("attackType").value);

    let dmg = 0;

    if (connects)
    {
        const v = sampleVariance(variancePM);
        dmg =
            attackType === "physical"
            ? physicalDamage(power, str, pdef, elemMod, v)
            : magicalDamage(power, mag, mdef, elemMod, v);

        if (isCrit)
        {
            dmg = Math.max(ifloor(dmg * 1.5), 1);
        }

        dmg = applyDefend(dmg, defending);
    }

    out("hitCrit").innerHTML =
    `<div>Hit Chance: <strong>${pct(hc)}</strong>${cannotMiss ? ' <span class="good">(cannot miss)</span>' : ''}</div>
     <div>Crit Chance: <strong>${pct(cc)}</strong></div>
     <div>${connects ? '<span class="good">Attack connected</span>' : '<span class="warn">Missed</span>'}
          (Hit Roll: ${hitRoll.toFixed(2)} < ${pct(hc)})</div>
     <div>${connects ? (isCrit ? '<span class="good">CRITICAL!</span>' : 'Normal hit') : ''}
          ${connects ? `(Crit Roll: ${critRoll.toFixed(2)} < ${pct(cc)})` : ''}</div>`;

    out("damage").innerHTML =
        connects
        ? `<div>Damage Dealt: <strong>${intfmt(dmg)}</strong>${flag("defending") ? ' (defending)' : ''}</div>`
        : `<div>No damage on miss...</div>`;


    // ATB / Cast block
    const atbRate = atbFillRate(speed);
    const castTime = num("castTime");
    const mpCost = num("mpCost");
    const hpCost = num("hpCost");
    const castProgress = num("castProgress");
    const minPenalty = num("minPenalty");
    const pushbackIntensity = num("pushbackIntensity");
    const currentATB = num("currentATB");

    const push = castInterruptNewATB(castTime, mpCost, hpCost, castProgress, minPenalty, pushbackIntensity, currentATB);

    out("atb").innerHTML =
        `<div>ATB Fill Rate: <strong>${atbRate.toFixed(2)}</strong> units/sec</div>
         <div>Interrupt blended factor: <strong>${push.blended.toFixed(2)}</strong></div>
         <div>Penalty Ratio: <strong>${push.penaltyRatio.toFixed(2)}</strong></div>
         <div>New ATB after interrupt: <strong>${push.newATB.toFixed(1)}</strong></div>`;
}

/** Reset inputs to sensible defaults for quick testing. */
function resetDefaults()
{
    el("power").value = "120";
    el("strength").value = "120";
    el("magic").value = "110";
    el("aim").value = "140";
    el("luck").value = "25";
    el("speed").value = "120";

    el("pdef").value = "90";
    el("mdef").value = "95";
    el("agility").value = "100";
    el("luckDef").value = "20";
    el("resistance").value = "0";

    el("attackType").value = "physical";
    el("cannotMiss").checked = false;
    el("defending").checked = false;
    el("variance").value = "0.05";

    el("castTime").value = "2.0";
    el("mpCost").value = "30";
    el("hpCost").value = "0";
    el("castProgress").value = "0.3";
    el("minPenalty").value = "0.25";
    el("pushbackIntensity").value = "0.7";
    el("currentATB").value = "60";
}

document.addEventListener("DOMContentLoaded", function()
{
    document.getElementById("btnCompute").addEventListener("click", function() { computeExpected(); });
    document.getElementById("btnRoll").addEventListener("click", function() { rollOnce(); });
    document.getElementById("btnReset").addEventListener("click", function() { resetDefaults(); });
    computeExpected();
});

/** Recalculate automatically when any field changes. */
document.querySelectorAll('.calc input, .calc select').forEach(function(element)
{
    const isButton = element.type === 'button' || element.type === 'submit';
    if(!isButton)
    {
        element.addEventListener('input', function()
        {
            computeExpected();
        });
        element.addEventListener('change', function()
        {
            computeExpected();
        });
    }
});