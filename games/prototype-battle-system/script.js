class Game
{
    constructor()
    {

        this.playerHP = 100;

        this.enemyHP = 100;

        this.playerAP = 0;

        this.enemyAP = 0;

        this.atbFill = 0;

        this.prevATBFill = 0;

        this.atbPaused = false;

        this.isActionInProgress = false;

        this.atbActionThresholds = [
            { percent: 25, ap: 4 },
            { percent: 50, ap: 8 },
            { percent: 75, ap: 12 },
            { percent: 100, ap: 12 }
        ];

        this.nextThresholdIndex = 0;

        this.windowLocked = {
            defend: false,
            attack: false,
            skill: false,
            magic: false
        };

        this.windowUsed = {
            defend: false,
            attack: false,
            skill: false,
            magic: false
        };

        this.enemyWindowLocked = {
            defend: false,
            attack: false,
            skill: false,
            magic: false
        };

        this.enemyWindowUsed = {
            defend: false,
            attack: false,
            skill: false,
            magic: false
        };

        this.enemyWindowRolled =
        {
            defend: false,
            attack: false,
            skill: false,
            magic: false
        };

        this.playerDefending = false;

        this.enemyDefending = false;

        this.plannedEnemyAction = null;

        this.lastPlayerActionTimeMs = -1;

        this.lastEnemyOptionName =
        {
            attack: null,
            skill: null,
            magic: null
        };

        this.atbBar = (document.getElementById('atb-bar'));

        this.apDisplay = (document.getElementById('ap-display'));

        this.messageLog = (document.getElementById('message-log'));

        this.playerHpElement = (document.getElementById('player-hp'));

        this.enemyHpElement = (document.getElementById('enemy-hp'));

        this.playerSprite = (document.getElementById('player-sprite'));

        this.enemySprite = (document.getElementById('enemy-sprite'));

        this.subMenu = (document.getElementById('sub-menu'));

        this.gameOver = false;

        this.gameLoopID = null;

        this.gameOverOverlay = (document.getElementById('gameover-overlay'));

        this.gameOverTitle = (document.getElementById('gameover-title'));

        this.restartButton = (document.getElementById('restart-button'));

        this.restartButton.addEventListener('click', () =>
        {
            window.location.reload();
        });

        this.bindUi();
        this.updateUi();
        this.startGameLoop();
    }

    bindUi()
    {
        const defendButton = (document.getElementById('defend-button'));

        const attackButton = (document.getElementById('attack-button'));

        const skillButton = (document.getElementById('skill-button'));

        const magicButton = (document.getElementById('magic-button'));

        defendButton.addEventListener('click', () =>
        {
            this.checkSelectActionWindow('defend');
        });

        attackButton.addEventListener('click', () =>
        {
            this.checkSelectActionWindow('attack');
        });

        skillButton.addEventListener('click', () =>
        {
            this.checkSelectActionWindow('skill');
        });

        magicButton.addEventListener('click', () =>
        {
            this.checkSelectActionWindow('magic');
        });
    }

    startGameLoop()
    {
        this.gameLoopID = window.setInterval(() =>
        {
            if (!this.atbPaused)
            {
                this.prevATBFill = this.atbFill;
                this.atbFill += 0.5;

                if (this.atbFill > 100)
                {
                    this.atbFill = 100;
                }

                this.lockActionWindows(this.prevATBFill, this.atbFill, this.windowUsed, this.windowLocked);
                this.lockActionWindows(this.prevATBFill, this.atbFill, this.enemyWindowUsed, this.enemyWindowLocked);

                this.handleThresholds();
                this.enemyLogic();
            }

            this.updateUi();
        }, 100);
    }

    checkGameOver()
    {
        if(this.gameOver)
        {
            return;
        }

        if (this.playerHP <= 0)
        {
            this.gameOver = true;
            this.showGameOver('You suck!');
            return;
        }

        if (this.enemyHP <= 0)
        {
            this.gameOver = true;
            this.showGameOver('Your winner!');
        }
    }

    showGameOver(text)
    {
        this.atbPaused = true;
        this.isActionInProgress = true;

        if (this.gameLoopID !== null)
        {
            window.clearInterval(this.gameLoopID);
            this.gameLoopID = null;
        }

        this.gameOverTitle.textContent = text;
        this.gameOverOverlay.classList.remove('hidden');
    }

    waitMs(ms)
    {
        return new Promise((resolve) =>
        {
            setTimeout(() => { resolve(); }, ms);
        });
    }

    isSubMenuOpen()
    {
        return !this.subMenu.classList.contains('hidden');
    }

    async runExclusiveAction(fn)
    {
        if (this.isActionInProgress)
        {
            return;
        }

        this.isActionInProgress = true;
        this.atbPaused = true;

        try
        {
            await fn();
        }
        finally
        {
            this.isActionInProgress = false;

            if (!this.isSubMenuOpen())
            {
                this.atbPaused = false;
            }
        }
    }

    getWindowForAtb(percent)
    {
        if (percent < 25)
        {
            return 'defend';
        }

        if (percent < 50)
        {
            return 'attack';
        }

        if (percent < 75)
        {
            return 'skill';
        }

        return 'magic';
    }

    getWindowInfo(window)
    {
        if (window === 'defend')
        {
            return { start: 0, end: 25, ap: 0 };
        }

        if (window === 'attack')
        {
            return { start: 25, end: 50, ap: 4 };
        }

        if (window === 'skill')
        {
            return { start: 50, end: 75, ap: 8 };
        }

        return { start: 75, end: 100, ap: 12 };
    }

    lockActionWindows(prev, now, used, locked)
    {
        const windows = ['defend', 'attack', 'skill', 'magic'];

        windows.forEach((w) =>
        {
            const info = this.getWindowInfo(w);

            if (!used[w] && !locked[w])
            {
                if (prev < info.end && now >= info.end)
                {
                    locked[w] = true;
                }
            }
        });
    }

    handleThresholds()
    {
        if (this.nextThresholdIndex < this.atbActionThresholds.length)
        {
            const t = this.atbActionThresholds[this.nextThresholdIndex];

            if (this.atbFill >= t.percent)
            {
                this.enemyAP = Math.max(this.enemyAP, t.ap);
                this.nextThresholdIndex += 1;
            }
        }
    }

    resetAtbCycle()
    {
        this.atbFill = 0;
        this.prevATBFill = 0;
        this.nextThresholdIndex = 0;

        // Just allow carryover, so we can save up for more powerful skills next ATB fill...
        //this.playerAp = 0;
        //this.enemyAp = 0;
        this.plannedEnemyAction = null;

        this.windowLocked =
        {
            defend: false,
            attack: false,
            skill: false,
            magic: false
        };

        this.windowUsed =
        {
            defend: false,
            attack: false,
            skill: false,
            magic: false
        };

        this.enemyWindowLocked =
        {
            defend: false,
            attack: false,
            skill: false,
            magic: false
        };

        this.enemyWindowUsed =
        {
            defend: false,
            attack: false,
            skill: false,
            magic: false
        };

        this.enemyWindowRolled =
        {
            defend: false,
            attack: false,
            skill: false,
            magic: false
        };

        this.hideSubMenu();

        this.atbPaused = false;
        this.isActionInProgress = false;
    }

    canSelectWindow(actionWindow)
    {
        if (this.atbPaused)
        {
            return false;
        }

        if (this.windowLocked[actionWindow] || this.windowUsed[actionWindow])
        {
            return false;
        }

        const current = this.getWindowForAtb(this.atbFill);
        return current === actionWindow;
    }

    checkSelectActionWindow(actionWindow)
    {
        if (!this.canSelectWindow(actionWindow))
        {
            return;
        }

        const info = this.getWindowInfo(actionWindow);

        if (actionWindow === 'defend')
        {
            const defendCost = 4;

            if (!this.applyPlayerAPDelta(-defendCost, 'DEFEND'))
            {
                this.battleLog('Not enough AP to defend!');
                return;
            }

            this.windowUsed[actionWindow] = true;

            this.playerDefending = true;
            this.lastPlayerActionTimeMs = performance.now();
            this.hideSubMenu();
            this.battleLog('You brace yourself for an incoming attack!');
            return;
        }

        // Gain AP for choosing this window...
        this.applyPlayerAPDelta(info.ap, actionWindow.toUpperCase() + ' window');

        this.windowUsed[actionWindow] = true;

        this.atbPaused = true;

        if (actionWindow === 'attack')
        {
            this.showAttackMenu();
        }
        else if (actionWindow === 'skill')
        {
            this.showSkillMenu();
        }
        else
        {
            this.showMagicMenu();
        }
    }

    getAttackOptions()
    {
        return [
            { name: 'Smack', dmg: [4, 6], cost: 1 },
            { name: 'Punch', dmg: [6, 8], cost: 2 },
            { name: 'Uppercut', dmg: [9, 12], cost: 4 }
        ];
    }

    getSkillOptions()
    {
        return [
            { name: 'Arrow Flurry', dmg: [2, 4], hits: [4, 8], cost: 4, arc: true },
            { name: '3 Hit Combo', dmg: [3, 5], hits: [3, 3], cost: 8 },
            { name: 'Random 1-5 Hits', dmg: [3*3, 5*3], hits: [1, 5], cost: 24 }
        ];
    }

    getMagicOptions()
    {
        return [
            { name: 'Magic Missile', dmg: [6, 8], hits: [1, 1], cost: 4 },
            { name: 'Fireball', dmg: [12, 16], cost: 8 },
            { name: 'Meteor Shower', dmg: [5*3, 7*3], hits: [3, 5], cost: 24 }
        ];
    }

    showAttackMenu()
    {
        this.renderSubMenu(this.getAttackOptions(), 'attack');
    }

    showSkillMenu()
    {
        this.renderSubMenu(this.getSkillOptions(), 'skill');
    }

    showMagicMenu()
    {
        this.renderSubMenu(this.getMagicOptions(), 'magic');
    }

    updateActionButtonLabels()
    {
        const defendButton = (document.getElementById('defend-button'));

        const attackButton = (document.getElementById('attack-button'));

        const skillButton = (document.getElementById('skill-button'));

        const magicButton = (document.getElementById('magic-button'));

        const defendGain = this.getWindowInfo('defend').ap;

        const attackGain = this.getWindowInfo('attack').ap;

        const skillGain = this.getWindowInfo('skill').ap;

        const magicGain = this.getWindowInfo('magic').ap;

        const defendCost = 4;

        defendButton.textContent = 'DEFEND (-' + defendCost + ' AP)';
        attackButton.textContent = 'ATTACK (+' + attackGain + ' AP)';
        skillButton.textContent = 'SKILL (+' + skillGain + ' AP)';
        magicButton.textContent = 'MAGIC (+' + magicGain + ' AP)';
    }

    formatApChange(before, after)
    {
        const newAmount = after - before;

        if (newAmount === 0)
        {
            return '+0 AP';
        }

        if (newAmount > 0)
        {
            return '+' + newAmount + ' AP';
        }

        return String(newAmount) + ' AP';
    }

    applyPlayerAPDelta(delta, context)
    {
        const before = this.playerAP;

        const afterRaw = before + delta;

        if (afterRaw < 0)
        {
            return false;
        }

        this.playerAP = afterRaw;

        this.battleLog(context + ' (' + this.formatApChange(before, this.playerAP) + ')');
        return true;
    }

    renderSubMenu(options, type)
    {
        this.subMenu.innerHTML = '';
        this.subMenu.classList.remove('hidden');

        options.forEach((opt) =>
        {
            const button = document.createElement('button');
            button.textContent = opt.name + ' (-' + opt.cost + ' AP)';
            button.dataset.cost = String(opt.cost);
            button.disabled = this.playerAP < opt.cost;
            
            button.title = this.describeOption(type, opt);

            button.addEventListener('click', () =>
            {
                void this.runExclusiveAction(async () =>
                {
                    if (this.playerAP < opt.cost)
                    {
                        return;
                    }

                    const buttons = this.subMenu.querySelectorAll('button');

                    buttons.forEach((b) =>
                    {
                        b.disabled = true;
                    });

                    this.lastPlayerActionTimeMs = performance.now();
                    
                    this.clearPlayerDefenseOnAction();

                    this.applyPlayerAPDelta(-opt.cost, opt.name);

                    this.hideSubMenu();

                    await this.resolveHits(true, type, opt);
                });
            });

            this.subMenu.appendChild(button);
        });
    }

    animateArrowArc()
    {
        return new Promise((resolve) =>
        {
            const battlefield = (document.getElementById('battlefield'));

            if (!battlefield)
            {
                resolve();
                return;
            }

            const bfRect = battlefield.getBoundingClientRect();

            const startRect = this.playerSprite.getBoundingClientRect();

            const endRect = this.enemySprite.getBoundingClientRect();

            const startX = (startRect.right - bfRect.left) - 10;

            const startY = (startRect.top - bfRect.top) + (startRect.height * 0.45);

            const endX = (endRect.left - bfRect.left) + 20;

            const endY = (endRect.top - bfRect.top) + (endRect.height * 0.45);

            if (getComputedStyle(battlefield).position === 'static')
            {
                battlefield.style.position = 'relative';
            }

            const wrapper = document.createElement('div');
            wrapper.style.position = 'absolute';
            wrapper.style.left = startX + 'px';
            wrapper.style.top = startY + 'px';

            wrapper.style.animation = 'none';
            wrapper.style.transition = 'none';
            wrapper.style.transform = 'none';

            const arrow = document.createElement('div');
            arrow.className = 'projectile arrow';

            arrow.style.position = 'absolute';
            arrow.style.left = '0px';
            arrow.style.top = '0px';

            arrow.style.animation = 'none';
            arrow.style.transition = 'none';

            wrapper.appendChild(arrow);
            battlefield.appendChild(wrapper);

            const durationMs = 420;

            const dx = endX - startX;

            const dy = endY - startY;

            const dist = Math.sqrt((dx * dx) + (dy * dy));

            const arcHeight = Math.max(60, dist * 0.35);

            const cx = startX + (dx * 0.5);

            const cy = startY + (dy * 0.5) - arcHeight;

            const startTime = performance.now();

            const easeOutCubic = (t) =>
            {
                const u = 1 - t;
                return 1 - (u * u * u);
            };

            const pointOnCurve = (t) =>
            {
                const omt = 1 - t;

                const x = (omt * omt * startX) + (2 * omt * t * cx) + (t * t * endX);

                const y = (omt * omt * startY) + (2 * omt * t * cy) + (t * t * endY);

                return { x, y };
            };

            const tick = (now) =>
            {
                const rawT = (now - startTime) / durationMs;

                const clamped = Math.min(1, Math.max(0, rawT));

                const t = easeOutCubic(clamped);

                const p0 = pointOnCurve(t);

                wrapper.style.left = p0.x + 'px';
                wrapper.style.top = p0.y + 'px';

                const t2 = Math.min(1, t + 0.02);

                const p1 = pointOnCurve(t2);

                const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x) * (180 / Math.PI);
                arrow.style.transform = 'translate(-50%, -50%) rotate(' + ang + 'deg)';

                if (clamped < 1)
                {
                    requestAnimationFrame(tick);
                }
                else
                {
                    wrapper.remove();
                    resolve();
                }
            };

            requestAnimationFrame(tick);
        });
    }

    animateArrowArcEnemy()
    {
        return new Promise((resolve) =>
        {
            const battlefield = (document.getElementById('battlefield'));
            
            if (!battlefield)
            {
                resolve();
                return;
            }

            const bfRect = battlefield.getBoundingClientRect();

            const startRect = this.enemySprite.getBoundingClientRect();

            const endRect = this.playerSprite.getBoundingClientRect();

            const startX = (startRect.left - bfRect.left) + 20;

            const startY = (startRect.top - bfRect.top) + (startRect.height * 0.45);

            const endX = (endRect.right - bfRect.left) - 10;

            const endY = (endRect.top - bfRect.top) + (endRect.height * 0.45);

            if (getComputedStyle(battlefield).position === 'static')
            {
                battlefield.style.position = 'relative';
            }

            const wrapper = document.createElement('div');
            wrapper.style.position = 'absolute';
            wrapper.style.left = startX + 'px';
            wrapper.style.top = startY + 'px';

            wrapper.style.animation = 'none';
            wrapper.style.transition = 'none';
            wrapper.style.transform = 'none';

            const arrow = document.createElement('div');
            arrow.className = 'projectile arrow';

            arrow.style.position = 'absolute';
            arrow.style.left = '0px';
            arrow.style.top = '0px';

            arrow.style.animation = 'none';
            arrow.style.transition = 'none';

            wrapper.appendChild(arrow);
            battlefield.appendChild(wrapper);

            const durationMs = 420;

            const dx = endX - startX;

            const dy = endY - startY;

            const dist = Math.sqrt((dx * dx) + (dy * dy));

            const arcHeight = Math.max(60, dist * 0.35);

            const cx = startX + (dx * 0.5);

            const cy = startY + (dy * 0.5) - arcHeight;

            const startTime = performance.now();

            const easeOutCubic = (t) =>
            {
                const u = 1 - t;
                return 1 - (u * u * u);
            };

            const pointOnCurve = (t) =>
            {
                const omt = 1 - t;

                const x = (omt * omt * startX) + (2 * omt * t * cx) + (t * t * endX);

                const y = (omt * omt * startY) + (2 * omt * t * cy) + (t * t * endY);

                return { x, y };
            };

            const tick = (now) =>
            {
                const rawT = (now - startTime) / durationMs;

                const clamped = Math.min(1, Math.max(0, rawT));

                const t = easeOutCubic(clamped);

                const p0 = pointOnCurve(t);

                wrapper.style.left = p0.x + 'px';
                wrapper.style.top = p0.y + 'px';

                const t2 = Math.min(1, t + 0.02);

                const p1 = pointOnCurve(t2);

                const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x) * (180 / Math.PI);
                arrow.style.transform = 'translate(-50%, -50%) rotate(' + ang + 'deg)';

                if (clamped < 1)
                {
                    requestAnimationFrame(tick);
                }
                else
                {
                    wrapper.remove();
                    resolve();
                }
            };

            requestAnimationFrame(tick);
        });
    }

    hideSubMenu()
    {
        this.subMenu.classList.add('hidden');
        this.subMenu.innerHTML = '';
    }

    async animateComboMelee(playerAttacks, hits, onEachHit)
    {
        const attacker = playerAttacks ? this.playerSprite : this.enemySprite;

        const target = playerAttacks ? this.enemySprite : this.playerSprite;

        const aRect = attacker.getBoundingClientRect();

        const tRect = target.getBoundingClientRect();

        const gap = 30;

        let approach;

        if (playerAttacks)
        {
            approach = (tRect.left - aRect.right) - gap;
        }
        else
        {
            approach = (tRect.right - aRect.left) + gap;
        }

        const lunge = playerAttacks ? 25 : -25;

        const startTransform = attacker.style.transform || 'translateX(0px)';
        attacker.style.transition = 'transform 150ms ease-out';
        attacker.style.transform = `translateX(${approach}px)`;

        await this.waitMs(200);

        let hitIndex = 0;

        while (hitIndex < hits)
        {
            attacker.style.transform = `translateX(${approach + lunge}px)`;
            await this.waitMs(150);

            attacker.style.transform = `translateX(${approach}px)`;
            await this.waitMs(150);

            if (onEachHit)
            {
                onEachHit();
            }

            hitIndex += 1;

            if (hitIndex < hits)
            {
                await this.waitMs(150);
            }
        }

        attacker.style.transform = startTransform;
    }

    applyDamageToEnemy(dmg, text)
    {
        if (this.enemyDefending)
        {
            dmg = Math.floor(dmg / 2);
            this.enemyDefending = false;
            this.battleLog('Enemy blocked some of the damage!');
        }

        this.enemyHP -= dmg;

        if (this.enemyHP < 0)
        {
            this.enemyHP = 0;
        }

        this.battleLog(text);
        this.updateUi();
        this.checkGameOver();
    }

    applyDamageToPlayer(dmg, text)
    {
        if (this.playerDefending)
        {
            dmg = Math.floor(dmg / 2);
            this.playerDefending = false;
            this.battleLog('Your defense reduced the incoming damage!');
        }

        this.playerHP -= dmg;

        if (this.playerHP < 0)
        {
            this.playerHP = 0;
        }

        this.battleLog(text);
        this.updateUi();
        this.checkGameOver();
    }

    enemyLogic()
    {
        if (this.atbPaused)
        {
            return;
        }

        const currentWindow = this.getWindowForAtb(this.atbFill);

        // Plan one action at a time, but allow more later in the cycle...
        if (!this.plannedEnemyAction)
        {
            this.maybePlanEnemyAction(currentWindow);
        }

        if (this.plannedEnemyAction)
        {
            const win = this.getWindowInfo(this.plannedEnemyAction.window);

            // Don't immediately retaliate right after the player...
            if (this.lastPlayerActionTimeMs > 0)
            {
                const sincePlayerMs = performance.now() - this.lastPlayerActionTimeMs;

                if (sincePlayerMs < 400)
                {
                    return;
                }
            }

            // Only fire if we are still inside the planned window and past the trigger time...
            if (this.atbFill >= this.plannedEnemyAction.triggerAtb && this.atbFill < (win.end - 0.05))
            {
                if (currentWindow === this.plannedEnemyAction.window)
                {
                    void this.runExclusiveAction(async () =>
                    {
                        if (!this.plannedEnemyAction)
                        {
                            return;
                        }

                        const plan = this.plannedEnemyAction;

                        await this.executeEnemyPlannedAction(plan);
                        this.plannedEnemyAction = null;
                    });
                }
            }
        }

        if (this.atbFill >= 100)
        {
            this.resetAtbCycle();
        }
    }

    async executeEnemyPlannedAction(plan)
    {
        if (this.enemyWindowLocked[plan.window] || this.enemyWindowUsed[plan.window])
        {
            return;
        }

        if (plan.type === 'defend')
        {
            if (this.enemyAP >= plan.cost)
            {
                this.enemyAP = Math.max(0, this.enemyAP - plan.cost);
                this.enemyDefending = true;
                this.battleLog('The enemy braces themself for an incoming attack!');
            }

            this.enemyWindowUsed[plan.window] = true;
            return;
        }

        this.enemyWindowUsed[plan.window] = true;

        if (this.enemyAP < plan.cost)
        {
            return;
        }

        this.enemyAP = Math.max(0, this.enemyAP - plan.cost);

        this.clearEnemyDefenseOnAction();

        const name = plan.optionName || plan.type;

        let table = [];

        if (plan.type === 'attack')
        {
            table = (this.getAttackOptions());
        }
        else if (plan.type === 'skill')
        {
            table = (this.getSkillOptions());
        }
        else
        {
            table = (this.getMagicOptions());
        }

        let opt = null;

        table.forEach((o) =>
        {
            if (o.name === name)
            {
                opt = o;
            }
        });

        if (!opt)
        {
            await this.animateMelee(false);

            const dmg = this.randomRangeInt(5, 10);
            this.applyDamageToPlayer(dmg, 'Enemy hits for ' + dmg + ' damage!');
            return;
        }

        await this.resolveHits(false, plan.type, opt);
    }

    getActionOptionDescriptions()
    {
        return {
            attack:
            {
                'Smack': 'A quick, low-power strike',
                'Punch': 'A normal punch that deals moderate damage',
                'Uppercut': 'A powerful blow that deals great damage'
            },
            skill:
            {
                'Arrow Flurry': 'Fire a volley of arrows, hitting the enemy multiple times',
                '3 Hit Combo': 'A precise three hit melee combo',
                'Random 1-5 Hits': 'Unpredictable punches of desperation. Can strike once or unleash a longer more devastating combo!'
            },
            magic:
            {
                'Magic Missile': 'Launch a bolt of pure magical energy',
                'Fireball': 'Hurl a ball of fire that explodes on impact for good damage',
                'Meteor Shower': 'Call down multiple meteors from the sky that fall down on the enemy'
            }
        };
    }

    describeOption(type, opt)
    {
        const all = this.getActionOptionDescriptions();
        const desc = (all[type] && all[type][opt.name]) ? all[type][opt.name] : '';

        let text = opt.name + '\n';
        text += desc + '\n';
        text += 'Damage: (' + opt.dmg[0] + ' - ' + opt.dmg[1] + ')';

        if (opt.hits > 0)
        {
            text += '\nHits: (' + opt.hits[0] + ' - ' + opt.hits[1] + ')';
        }

        return text;
    }

    maybePlanEnemyAction(currentWindow)
    {
        if (this.enemyWindowLocked[currentWindow] || this.enemyWindowUsed[currentWindow])
        {
            return;
        }

        const skipActionChance =
        {
            defend: 0.20,
            attack: 0.15,
            skill: 0.25,
            magic: 0.30
        };

        if (!this.enemyWindowRolled[currentWindow])
        {
            this.enemyWindowRolled[currentWindow] = true;

            if (Math.random() < skipActionChance[currentWindow])
            {
                this.enemyWindowUsed[currentWindow] = true;
                return;
            }
        }

        const info = this.getWindowInfo(currentWindow);

        if (this.atbFill >= (info.end - 2))
        {
            return;
        }

        let desire = 0;

        if (currentWindow === 'defend')
        {
            desire = (this.enemyHP <= 35) ? 0.6 : 0.1;
        }
        else if (currentWindow === 'attack')
        {
            desire = (this.enemyAP >= 1) ? 0.55 : 0;
        }
        else if (currentWindow === 'skill')
        {
            desire = (this.enemyAP >= 5) ? 0.55 : 0;
        }
        else
        {
            desire = (this.enemyAP >= 5) ? 0.7 : 0.2;
        }

        if (Math.random() > desire)
        {
            return;
        }

        const chosen = this.chooseEnemyActionForWindow(currentWindow);

        if (!chosen)
        {
            return;
        }

        if (this.enemyAP < chosen.cost)
        {
            return;
        }

        const trigger = this.randomRangeFloat(info.start + 1, info.end - 1.25);

        this.plannedEnemyAction =
        {
            window: currentWindow,
            type: chosen.type,
            cost: chosen.cost,
            triggerAtb: trigger,
            optionName: chosen.optionName
        };
    }

    chooseEnemyActionForWindow(window)
    {
        if (window === 'defend')
        {
            return { type: 'defend', cost: 4 };
        }

        const pickIndexWithVariance = (length, targetIndex, variance) =>
        {
            if (length <= 1)
            {
                return 0;
            }

            // Small chance to fully randomize... (so the AI doesn't become too predictable)
            if (Math.random() < 0.15)
            {
                return Math.floor(Math.random() * length);
            }

            // Triangular distribution type shit...

            const n = (this.randomRangeFloat(-1, 1) + this.randomRangeFloat(-1, 1) + this.randomRangeFloat(-1, 1)) / 3;

            const raw = targetIndex + (n * variance);

            const rounded = Math.round(raw);

            return Math.max(0, Math.min(length - 1, rounded));
        };

        let options = [];

        if (window === 'attack')
        {
            options = (this.getAttackOptions());
        }
        else if (window === 'skill')
        {
            options = (this.getSkillOptions());
        }
        else
        {
            options = (this.getMagicOptions());
        }

        const affordable = options.filter((o) =>
        {
            return this.enemyAP >= o.cost;
        });

        if (affordable.length === 0)
        {
            return null;
        }

        affordable.sort((a, b) =>
        {
            return a.cost - b.cost;
        });

        const isPlayerHPLow = this.playerHP <= 35;

        const lastName = this.lastEnemyOptionName[window];

        let pool = affordable;

        if (lastName && affordable.length > 1)
        {
            const nonRepeat = affordable.filter((o) =>
            {
                return o.name !== lastName;
            });

            if (nonRepeat.length > 0)
            {
                // Mostly avoid repeating, but keep a small chance to repeat anyway (so it feels less scripted)...
                if (Math.random() > 0.10)
                {
                    pool = nonRepeat;
                }
            }
        }

        const targetIndex = isPlayerHPLow ? (pool.length - 1) : Math.floor(pool.length * 0.55);

        const variance = isPlayerHPLow ? Math.max(0.85, pool.length * 0.25) : Math.max(1.15, pool.length * 0.35);

        const pickIndex = pickIndexWithVariance(pool.length, targetIndex, variance);

        const pick = pool[pickIndex];

        this.lastEnemyOptionName[window] = pick.name;

        return {
            type: window,
            cost: pick.cost,
            optionName: pick.name
        };
    }

    async animateMelee(playerAttacks)
    {
        const attacker = playerAttacks ? this.playerSprite : this.enemySprite;

        const target = playerAttacks ? this.enemySprite : this.playerSprite;

        const aRect = attacker.getBoundingClientRect();

        const tRect = target.getBoundingClientRect();

        const gap = 30;

        let approach;

        if (playerAttacks)
        {
            approach = (tRect.left - aRect.right) - gap;
        }
        else
        {
            approach = (tRect.right - aRect.left) + gap;
        }

        const startTransform = attacker.style.transform || 'translateX(0px)';
        attacker.style.transition = 'transform 150ms ease-out';
        attacker.style.transform = `translateX(${approach}px)`;

        await this.waitMs(300);

        attacker.style.transform = startTransform;
    }

    async animateProjectile(spellName, attackerIsPlayer)
    {
        return new Promise((resolve) =>
        {
            const p = document.createElement('div');
            p.classList.add('projectile');

            if (spellName === 'Fireball')
            {
                p.classList.add('fireball');
            }
            else if (spellName === 'Magic Missile')
            {
                p.classList.add('missile');
            }

            // IMPORTANT: Prevent any CSS keyframes/transitions from overriding, hahaha...
            p.style.animation = 'none';
            p.style.transition = 'none';

            const battlefield = (document.getElementById('battlefield'));

            if (!battlefield)
            {
                resolve();
                return;
            }

            if (getComputedStyle(battlefield).position === 'static')
            {
                battlefield.style.position = 'relative';
            }

            const fromSprite = attackerIsPlayer ? this.playerSprite : this.enemySprite;

            const toSprite = attackerIsPlayer ? this.enemySprite : this.playerSprite;

            const bfRect = battlefield.getBoundingClientRect();

            const fromRect = fromSprite.getBoundingClientRect();

            const toRect = toSprite.getBoundingClientRect();

            const startX = attackerIsPlayer ? (fromRect.right - bfRect.left) - 10 : (fromRect.left - bfRect.left) + 10;

            const startY = (fromRect.top - bfRect.top) + (fromRect.height * 0.45);

            const endX = attackerIsPlayer ? (toRect.left - bfRect.left) + 10 : (toRect.right - bfRect.left) - 10;

            const endY = (toRect.top - bfRect.top) + (toRect.height * 0.45);

            p.style.position = 'absolute';
            p.style.left = startX + 'px';
            p.style.top = startY + 'px';

            // Make sure we neutralize css right/translate defaults...
            p.style.right = 'auto';
            p.style.bottom = 'auto';
            p.style.transform = 'translate(-50%, -50%)';

            battlefield.appendChild(p);

            const durationMs = 650;

            const startTime = performance.now();

            const easeOutCubic = (t) =>
            {
                const u = 1 - t;
                return 1 - (u * u * u);
            };

            const tick = (now) =>
            {
                const rawT = (now - startTime) / durationMs;

                const clamped = Math.min(1, Math.max(0, rawT));

                const t = easeOutCubic(clamped);

                const x = startX + ((endX - startX) * t);

                const y = startY + ((endY - startY) * t);

                p.style.left = x + 'px';
                p.style.top = y + 'px';

                if (clamped < 1)
                {
                    requestAnimationFrame(tick);
                    return;
                }

                p.remove();
                resolve();
            };

            requestAnimationFrame(tick);
        });
    }

    async animateMeteor(attackerIsPlayer)
    {
        const battlefield = (document.getElementById('battlefield'));

        if (!battlefield)
        {
            return;
        }

        if (getComputedStyle(battlefield).position === 'static')
        {
            battlefield.style.position = 'relative';
        }

        const targetSprite = attackerIsPlayer ? this.enemySprite : this.playerSprite;

        const bfRect = battlefield.getBoundingClientRect();

        const tRect = targetSprite.getBoundingClientRect();

        const targetCenterX = (tRect.left - bfRect.left) + (tRect.width * 0.5);

        const spread = 90 / 2;

        const left = targetCenterX + this.randomRangeInt(-spread, spread);

        const m = document.createElement('div');
        m.className = 'projectile meteor';

        m.style.position = 'absolute';
        m.style.left = left + 'px';

        battlefield.appendChild(m);

        await this.waitMs(700);

        m.remove();
    }

    async resolveHits(attackerIsPlayer, type, opt)
    {
        let hits = 1;

        if (opt.hits)
        {
            hits = this.randomRangeInt(opt.hits[0], opt.hits[1]);
        }

        if (type === 'skill' && opt.hits && !opt.arc)
        {
            await this.animateComboMelee(attackerIsPlayer, hits, () =>
            {
                const dmg = this.randomRangeInt(opt.dmg[0], opt.dmg[1]);

                if (attackerIsPlayer)
                {
                    this.applyDamageToEnemy(dmg, '[' + opt.name + '] hits for ' + dmg + ' damage!');
                }
                else
                {
                    this.applyDamageToPlayer(dmg, 'Enemy uses [' + opt.name + '] for ' + dmg + ' damage!');
                }
            });

            return;
        }

        let hitIndex = 0;

        while (hitIndex < hits)
        {
            const dmg = this.randomRangeInt(opt.dmg[0], opt.dmg[1]);

            if (opt.arc)
            {
                if (attackerIsPlayer)
                {
                    await this.animateArrowArc();
                }
                else
                {
                    await this.animateArrowArcEnemy();
                }
            }
            else if (type === 'magic')
            {
                if (opt.name === 'Meteor Shower')
                {
                    await this.animateMeteor(attackerIsPlayer);
                }
                else
                {
                    await this.animateProjectile(opt.name, attackerIsPlayer);
                }
            }
            else
            {
                await this.animateMelee(attackerIsPlayer);
            }

            if (attackerIsPlayer)
            {
                this.applyDamageToEnemy(dmg, '[' + opt.name + '] hits for ' + dmg + ' damage!');
            }
            else
            {
                this.applyDamageToPlayer(dmg, 'Enemy uses [' + opt.name + '] for ' + dmg + ' damage!');
            }

            hitIndex += 1;

            if (hitIndex < hits)
            {
                await this.waitMs(250);
            }
        }
    }

    clearPlayerDefenseOnAction()
    {
        if (this.playerDefending)
        {
            this.playerDefending = false;
        }
    }

    clearEnemyDefenseOnAction()
    {
        if (this.enemyDefending)
        {
            this.enemyDefending = false;
        }
    }

    updateUi()
    {
        this.updateActionButtonLabels();

        this.playerHpElement.textContent = String(this.playerHP);
        this.enemyHpElement.textContent = String(this.enemyHP);
        this.atbBar.style.width = this.atbFill + '%';
        this.apDisplay.textContent = 'AP: ' + this.playerAP;

        const defendButton = (document.getElementById('defend-button'));

        const attackButton = (document.getElementById('attack-button'));

        const skillButton = (document.getElementById('skill-button'));

        const magicButton = (document.getElementById('magic-button'));

        defendButton.disabled = !this.canSelectWindow('defend');
        attackButton.disabled = !this.canSelectWindow('attack');
        skillButton.disabled = !this.canSelectWindow('skill');
        magicButton.disabled = !this.canSelectWindow('magic');

        if (!this.subMenu.classList.contains('hidden'))
        {
            const buttons = this.subMenu.querySelectorAll('button');

            buttons.forEach((b) =>
            {
                const cost = Number(b.dataset.cost || '0');
                b.disabled = this.playerAP < cost;
            });
        }
    }

    battleLog(text)
    {
        const p = document.createElement('p');
        p.textContent = text;
        this.messageLog.appendChild(p);
        this.messageLog.scrollTop = this.messageLog.scrollHeight;
    }

    randomRangeInt(min, max)
    {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    randomRangeFloat(min, max)
    {
        return (Math.random() * (max - min)) + min;
    }
}

window.addEventListener('DOMContentLoaded', () =>
{
    new Game();
});