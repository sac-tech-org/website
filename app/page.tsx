import type { Metadata } from "next";
import Link from "next/link";
import { BridgeArt } from "../components/bridge-art";
import { JoinCommunity } from "../components/join-community";
import style from "./home.module.css";

export const metadata: Metadata = {
	description:
		"Meet, learn, and build with Sacramento's welcoming technology community.",
};

export default function Home() {
	return (
		<main className={style.page} id="main-content">
			<section className={style.hero}>
				<div className={style.heroInner}>
					<div className={style.heroCopy}>
						<p className={style.eyebrow}>A technology community for Sacramento</p>
						<h1>Sacramento tech, built together.</h1>
						<p className={style.heroText}>
							A welcoming home for the people who design, build, teach, and
							grow technology in our region.
						</p>
						<div className={style.heroActions}>
							<Link className={style.primaryAction} href="/events">
								Explore events <span aria-hidden="true">→</span>
							</Link>
							<Link className={style.secondaryAction} href="#join">
								Join the community
							</Link>
						</div>
					</div>
					<BridgeArt className={style.heroArt} />
				</div>
			</section>

			<section className={style.mission} id="community">
				<div className={style.sectionInner}>
					<div className={style.sectionIntro}>
						<p className={style.eyebrowDark}>Our mission</p>
						<h2>Meet people. Share skills. Build locally.</h2>
						<p>
							SacTech brings together technologists, designers, students,
							career changers, and community members through shared learning
							and local connection.
						</p>
					</div>

					<div className={style.values}>
						<article>
							<span aria-hidden="true" className={style.valueMark}>
								01
							</span>
							<h3>Inclusive</h3>
							<p>
								Every background, identity, discipline, and experience level
								belongs here.
							</p>
						</article>
						<article>
							<span aria-hidden="true" className={style.valueMark}>
								02
							</span>
							<h3>Practical</h3>
							<p>
								Real skills, generous conversation, and useful connections for
								our local community.
							</p>
						</article>
						<article>
							<span aria-hidden="true" className={style.valueMark}>
								03
							</span>
							<h3>Civic-minded</h3>
							<p>
								We use technology to support our neighbors and strengthen the
								region we share.
							</p>
						</article>
					</div>
				</div>
			</section>

			<section className={style.eventsPreview}>
				<div className={style.sectionInner}>
					<div className={style.eventsPanel}>
						<p className={style.eyebrowDark}>Upcoming in Sacramento</p>
						<h2>The community calendar is getting a local refresh.</h2>
						<p>
							We are replacing the imported sample schedule with verified
							SacTech and community events. The new lineup will appear here as
							soon as it is ready.
						</p>
						<Link className={style.textAction} href="/events">
							Visit the events page <span aria-hidden="true">→</span>
						</Link>
					</div>
					<div className={style.communityPanel}>
						<p className={style.eyebrow}>How we gather</p>
						<h2>There is a place for you at the table.</h2>
						<ul>
							<li>Community conversations</li>
							<li>Peer-led learning</li>
							<li>Local and online gatherings</li>
						</ul>
						<Link href="/code-of-conduct">How we care for the community</Link>
					</div>
				</div>
			</section>

			<section className={style.join} id="join">
				<div className={style.joinInner}>
					<div>
						<p className={style.eyebrow}>Join the community</p>
						<h2>Come build a better Sacramento with us.</h2>
						<p>
							Join the SacTech Slack to meet neighbors, share what you know,
							and find your next local connection.
						</p>
					</div>
					<JoinCommunity inviteLink={process.env.NEXT_PUBLIC_INVITE_LINK} />
				</div>
			</section>
		</main>
	);
}
